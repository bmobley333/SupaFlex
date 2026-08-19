// src/components/modals/UniversalLinksModal.tsx
// Two-Pane Master Links Hub for Managing, Organizing, and Real-Time Party Sharing across all Scopes

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Link2,
  ExternalLink,
  Plus,
  Edit2,
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
} from 'lucide-react';
import { EncounterLink, ReceivedLinkItem } from '../../types/adventures';
import { useCharacterStore } from '../../store/useCharacterStore';
import { useAdventureStore } from '../../store/useAdventureStore';
import { useReceivedLinksStore } from '../../store/useReceivedLinksStore';
import { gameApi } from '../../services/api';

export type LinkScope = 'gm' | 'adventure' | 'encounter' | 'player' | 'character' | 'received';

export interface UniversalLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialScope?: LinkScope;
  themeColor?: 'teal' | 'indigo' | 'amber' | 'cyan' | 'rose' | 'emerald';
}

const CATEGORY_TAGS = ['General', 'Handout', 'Map', 'Lore', 'Art', 'Rules', 'Tool', 'Music'];

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
  const markAsRead = useReceivedLinksStore((state) => state.markAsRead);
  const markAllAsRead = useReceivedLinksStore((state) => state.markAllAsRead);
  const deleteReceivedLink = useReceivedLinksStore((state) => state.deleteReceivedLink);
  const clearReceivedLinks = useReceivedLinksStore((state) => state.clearReceivedLinks);
  const dispatchLinksToParty = useReceivedLinksStore((state) => state.dispatchLinksToParty);

  // Active Scope State
  const defaultScope: LinkScope = activeRole === 'gm' ? 'gm' : 'player';
  const [currentScope, setCurrentScope] = useState<LinkScope>(initialScope || defaultScope);

  // Sync initial scope on modal open or role change
  useEffect(() => {
    if (isOpen) {
      if (initialScope) {
        setCurrentScope(initialScope);
      } else {
        setCurrentScope(activeRole === 'gm' ? 'gm' : 'player');
      }
    }
  }, [isOpen, initialScope, activeRole]);

  // Form states for creating / editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formTag, setFormTag] = useState('General');
  const [formDesc, setFormDesc] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState('ALL');

  // Dispatch / Share states
  const [selectedLinkIds, setSelectedLinkIds] = useState<string[]>([]);
  const [sendToAllParty, setSendToAllParty] = useState(true);
  const [selectedRecipientCharacterIds, setSelectedRecipientCharacterIds] = useState<string[]>([]);
  const [partyMembers, setPartyMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [isDispatching, setIsDispatching] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

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
          title: 'GM Global Links',
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
          title: 'Adventure Links',
          subtitle: activeAdv ? activeAdv.title : 'No Active Adventure Selected',
          links: activeAdv?.links || [],
          icon: <Map className="w-5 h-5 text-indigo-400" />,
          activeColor: 'bg-indigo-600',
          accentText: 'text-indigo-300',
          badgeStyle: 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40',
          isDisabled: !activeAdv,
          disabledReason: 'Select or create an adventure in GM Screen to manage Adventure Links.',
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
          title: 'Encounter Links',
          subtitle: activeEnc ? `${activeAdv?.title || 'Adv'} > ${activeEnc.title}` : 'No Active Encounter Selected',
          links: activeEnc?.links || [],
          icon: <Swords className="w-5 h-5 text-amber-400" />,
          activeColor: 'bg-amber-600',
          accentText: 'text-amber-300',
          badgeStyle: 'bg-amber-950/80 text-amber-300 border-amber-500/40',
          isDisabled: !activeEnc || !activeAdv || !activeAct,
          disabledReason: 'Select an encounter in GM Screen to manage Encounter-specific links.',
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
          title: 'Player Global Links',
          subtitle: playerEmail ? `Account: ${playerEmail}` : 'Account-Wide Player Links',
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
          title: 'Character Links & Bio',
          subtitle: activeCharacter ? activeCharacter.name : 'No Active Hero Selected',
          links: activeCharacter?.sheet_data?.character_links || [],
          icon: <Scroll className="w-5 h-5 text-indigo-400" />,
          activeColor: 'bg-indigo-600',
          accentText: 'text-indigo-300',
          badgeStyle: 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40',
          isDisabled: !activeCharacter,
          disabledReason: 'Select or load a hero character to manage character-specific links.',
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
          title: 'Received Links & Handouts',
          subtitle: 'Real-Time In-Session Shared Links Inbox',
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
    setEditingId(link.id);
    setFormName(link.name);
    setFormUrl(link.url);
    setFormTag(link.categoryTag || 'General');
    setFormDesc(link.description || '');
    if (nameInputRef.current) {
      nameInputRef.current.focus();
    }
  };

  const handleCancelForm = () => {
    setEditingId(null);
    setFormName('');
    setFormUrl('');
    setFormTag('General');
    setFormDesc('');
  };

  const handleSaveForm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formName.trim() || !formUrl.trim() || isSubmitting || scopeData.isDisabled) return;

    setIsSubmitting(true);
    const formattedUrl = formatUrl(formUrl);

    try {
      if (editingId) {
        await scopeData.onUpdate(editingId, formName.trim(), formattedUrl, formTag, formDesc.trim());
        showToast(`Updated "${formName.trim()}"`);
      } else {
        await scopeData.onAdd(formName.trim(), formattedUrl, formTag, formDesc.trim());
        showToast(`Added "${formName.trim()}"`);
      }
      handleCancelForm();
    } catch (err) {
      console.error('[UniversalLinksModal] Error saving link:', err);
      showToast('Failed to save link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (link: EncounterLink) => {
    if (confirm(`Delete link "${link.name}"?`)) {
      try {
        await scopeData.onDelete(link.id);
        setSelectedLinkIds((prev) => prev.filter((id) => id !== link.id));
        showToast(`Deleted "${link.name}"`);
      } catch (err) {
        console.error('[UniversalLinksModal] Error deleting link:', err);
      }
    }
  };

  const handleOpenLink = (url: string, receivedId?: string) => {
    if (!url) return;
    if (receivedId) {
      markAsRead(receivedId);
    }
    window.open(formatUrl(url), '_blank', 'noopener,noreferrer');
  };

  const handleSaveReceivedToActiveScope = async (item: ReceivedLinkItem) => {
    try {
      if (activeRole === 'gm') {
        await addGmLink(item.name, item.url, item.categoryTag || 'Handout', item.description);
        showToast(`Saved "${item.name}" to GM Links!`);
      } else {
        addPlayerLink(item.name, item.url, item.categoryTag || 'Handout', item.description);
        showToast(`Saved "${item.name}" to Player Links!`);
      }
    } catch (err) {
      console.error('[UniversalLinksModal] Error saving received link:', err);
      showToast('Failed to save link.');
    }
  };

  // Toggle link selection for dispatch
  const handleToggleSelectLink = (linkId: string) => {
    setSelectedLinkIds((prev) =>
      prev.includes(linkId) ? prev.filter((id) => id !== linkId) : [...prev, linkId]
    );
  };

  const handleSelectAllLinks = () => {
    if (selectedLinkIds.length === filteredLinks.length) {
      setSelectedLinkIds([]);
    } else {
      setSelectedLinkIds(filteredLinks.map((l) => l.id));
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
      showToast('Please select at least 1 link to share.');
      return;
    }
    if (!activePartyId) {
      showToast('No active party room connected.');
      return;
    }

    const linksToSend = scopeData.links.filter((l) => selectedLinkIds.includes(l.id));
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
      showToast(`🚀 Dispatched ${result.count} link(s) to ${sendToAllParty ? 'Entire Party' : `${selectedRecipientCharacterIds.length} member(s)`}!`);
      setSelectedLinkIds([]);
    } else {
      showToast('Failed to dispatch links.');
    }
  };

  // Filtered links
  const filteredLinks = useMemo(() => {
    return scopeData.links.filter((link) => {
      const matchSearch =
        !searchQuery ||
        link.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        link.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (link.categoryTag && link.categoryTag.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (link.description && link.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        ((link as ReceivedLinkItem).senderName &&
          (link as ReceivedLinkItem).senderName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchTag =
        currentScope === 'received' ||
        selectedTagFilter === 'ALL' ||
        (link.categoryTag || 'General').toLowerCase() === selectedTagFilter.toLowerCase();

      return matchSearch && matchTag;
    });
  }, [scopeData.links, searchQuery, selectedTagFilter, currentScope]);

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
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 shadow-inner">
              {scopeData.icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-extrabold text-base tracking-wide text-white uppercase font-outfit">
                  {scopeData.title}
                </h2>
                <span className={`text-[11px] font-mono font-extrabold px-2 py-0.5 rounded-md border ${scopeData.badgeStyle}`}>
                  {scopeData.links.length} Links
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono truncate max-w-md">{scopeData.subtitle}</p>
            </div>
          </div>

          {/* Role-Aware KISS Multi-Option Pill Switch */}
          <div className="bg-slate-950/80 border border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner backdrop-blur-md">
            {activeRole === 'gm' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentScope('gm');
                    handleCancelForm();
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
                    handleCancelForm();
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
                    handleCancelForm();
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
                    handleCancelForm();
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
                    handleCancelForm();
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
                handleCancelForm();
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

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Two-Pane Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* ======================================================================== */}
          {/* LEFT PANE: Form & Dispatcher                                            */}
          {/* ======================================================================== */}
          <div className="w-[380px] border-r border-slate-800 bg-slate-950/40 p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
            {currentScope !== 'received' ? (
              <>
                {/* 1. Add / Edit Link Form */}
                <form onSubmit={handleSaveForm} className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl flex flex-col gap-3 shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      {editingId ? <Edit2 className="w-3.5 h-3.5 text-amber-400" /> : <Plus className="w-3.5 h-3.5 text-emerald-400" />}
                      {editingId ? 'Edit Link' : `Add Link to ${scopeData.title.split(' ')[0]}`}
                    </span>
                    {editingId && (
                      <button
                        type="button"
                        onClick={handleCancelForm}
                        className="text-[10px] text-slate-400 hover:text-slate-200 underline cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  {scopeData.isDisabled ? (
                    <div className="p-3 bg-amber-950/40 border border-amber-500/40 rounded-lg text-xs text-amber-300">
                      {scopeData.disabledReason}
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-slate-400">Link Name / Title</label>
                        <input
                          ref={nameInputRef}
                          type="text"
                          required
                          placeholder="e.g. Dungeon Map, Character Lore"
                          value={formName}
                          onChange={(e) => setFormName(e.target.value)}
                          className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-slate-400">Target URL</label>
                        <input
                          type="text"
                          required
                          placeholder="https://..."
                          value={formUrl}
                          onChange={(e) => setFormUrl(e.target.value)}
                          className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-slate-400">Category Tag</label>
                          <select
                            value={formTag}
                            onChange={(e) => setFormTag(e.target.value)}
                            className="px-2 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
                          >
                            {CATEGORY_TAGS.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[11px] font-bold text-slate-400">Optional Notes / Context</label>
                        <input
                          type="text"
                          placeholder="Brief note or description..."
                          value={formDesc}
                          onChange={(e) => setFormDesc(e.target.value)}
                          className="px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer ${
                          editingId
                            ? 'bg-amber-600 hover:bg-amber-500 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        } disabled:opacity-50`}
                      >
                        {editingId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                        <span>{editingId ? 'Save Link Changes' : '+ Add Link to Scope'}</span>
                      </button>
                    </>
                  )}
                </form>

                {/* 2. Party Dispatcher Section */}
                <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl flex flex-col gap-3 shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                      <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                      Party Dispatcher
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {selectedLinkIds.length} link(s) selected
                    </span>
                  </div>

                  {/* Destination Option: Entire Party vs Specific */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-bold text-slate-400 flex items-center justify-between">
                      <span>Destination</span>
                      <span className="text-[10px] font-mono text-cyan-400">
                        {activePartyId ? `Party: ${activePartyId.slice(0, 6).toUpperCase()}` : 'No Party Room'}
                      </span>
                    </label>

                    <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-2 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => setSendToAllParty(true)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                          sendToAllParty
                            ? 'bg-cyan-600/30 text-cyan-200 border border-cyan-500/50'
                            : 'hover:bg-slate-900 text-slate-400 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Entire Party (Everyone)</span>
                        </div>
                        {sendToAllParty && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSendToAllParty(false)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition cursor-pointer ${
                          !sendToAllParty
                            ? 'bg-cyan-600/30 text-cyan-200 border border-cyan-500/50'
                            : 'hover:bg-slate-900 text-slate-400 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Select Individual Members</span>
                        </div>
                        {!sendToAllParty && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                      </button>

                      {/* Member Checkbox List */}
                      {!sendToAllParty && (
                        <div className="mt-1 pt-2 border-t border-slate-800/80 flex flex-col gap-1 max-h-36 overflow-y-auto">
                          {isLoadingMembers ? (
                            <div className="flex items-center justify-center gap-2 py-3 text-xs text-slate-400">
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                              <span>Loading party members...</span>
                            </div>
                          ) : partyMembers.length === 0 ? (
                            <p className="text-[11px] text-slate-500 italic text-center py-2">
                              No active party members connected.
                            </p>
                          ) : (
                            partyMembers.map((m) => {
                              const charName = m.character?.name || m.player_email || 'Party Hero';
                              const charId = String(m.character_id || m.id);
                              const isChecked = selectedRecipientCharacterIds.includes(charId);
                              return (
                                <button
                                  key={charId}
                                  type="button"
                                  onClick={() => handleToggleRecipient(charId)}
                                  className={`w-full px-2 py-1 rounded text-left text-xs flex items-center justify-between transition cursor-pointer ${
                                    isChecked
                                      ? 'bg-indigo-950/60 text-indigo-200 font-bold border border-indigo-500/40'
                                      : 'hover:bg-slate-900 text-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 truncate">
                                    {isChecked ? (
                                      <CheckSquare className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                    ) : (
                                      <Square className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                                    )}
                                    <span className="truncate">{charName}</span>
                                  </div>
                                  <span className="text-[10px] font-mono text-slate-500">
                                    {m.player_email ? m.player_email.split('@')[0] : ''}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dispatch Action Button */}
                  <button
                    type="button"
                    disabled={selectedLinkIds.length === 0 || isDispatching || !activePartyId}
                    onClick={handleDispatchSelected}
                    className="py-2 px-3 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition flex items-center justify-center gap-1.5 shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {isDispatching
                        ? 'Broadcasting...'
                        : `🚀 Share ${selectedLinkIds.length} Link(s) to ${sendToAllParty ? 'Party' : 'Selected'}`}
                    </span>
                  </button>
                </div>
              </>
            ) : (
              /* Received Tab Left Info */
              <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl flex flex-col gap-3 shadow-md">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Inbox className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                    Received Inbox
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Links, online resources, and documents shared with you by the GM or other party members appear in this inbox in real-time.
                </p>

                <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Total Received:</span>
                    <span className="font-mono font-bold text-white">{receivedLinks.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Unread Items:</span>
                    <span className="font-mono font-bold text-rose-400">{unreadCount}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button
                    type="button"
                    disabled={unreadCount === 0}
                    onClick={markAllAsRead}
                    className="py-1.5 px-3 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <Check className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Mark All as Read</span>
                  </button>

                  <button
                    type="button"
                    disabled={receivedLinks.length === 0}
                    onClick={() => {
                      if (confirm('Clear all received links from your local inbox?')) {
                        clearReceivedLinks();
                        showToast('Received links cleared.');
                      }
                    }}
                    className="py-1.5 px-3 rounded-lg text-xs font-bold bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/40 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Clear Inbox</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ======================================================================== */}
          {/* RIGHT PANE: Links Grid & Filter Bar                                     */}
          {/* ======================================================================== */}
          <div className="flex-1 flex flex-col p-4 overflow-hidden gap-3">
            {/* Filter / Search Controls */}
            <div className="flex items-center justify-between gap-3 shrink-0">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder={currentScope === 'received' ? 'Search received links...' : `Search ${scopeData.title.toLowerCase()}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950/90 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              {currentScope !== 'received' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAllLinks}
                    className="px-2.5 py-1.5 bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                    title="Select / Unselect All for Sharing"
                  >
                    {selectedLinkIds.length === filteredLinks.length && filteredLinks.length > 0 ? (
                      <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <span>{selectedLinkIds.length === filteredLinks.length && filteredLinks.length > 0 ? 'Deselect All' : 'Select All'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Tag Filter Pills (for My Links) */}
            {currentScope !== 'received' && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedTagFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                    selectedTagFilter === 'ALL'
                      ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800/80'
                  }`}
                >
                  ALL ({scopeData.links.length})
                </button>
                {CATEGORY_TAGS.map((tag) => {
                  const count = scopeData.links.filter((l) => (l.categoryTag || 'General').toLowerCase() === tag.toLowerCase()).length;
                  if (count === 0 && selectedTagFilter !== tag) return null;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setSelectedTagFilter(tag)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                        selectedTagFilter === tag
                          ? 'bg-slate-800 text-cyan-300 border border-cyan-500/40 shadow-sm'
                          : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800/80'
                      }`}
                    >
                      <span>{tag}</span>
                      <span className="text-[10px] font-mono opacity-70">({count})</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Links Cards List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {currentScope !== 'received' ? (
                filteredLinks.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-950/30 rounded-2xl border border-slate-800/60 text-center">
                    <Link2 className="w-10 h-10 text-slate-600 mb-2" />
                    <p className="text-xs font-bold text-slate-400">No links in {scopeData.title}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {scopeData.isDisabled
                        ? scopeData.disabledReason
                        : 'Use the form on the left to add external documents, maps, tools, or art.'}
                    </p>
                  </div>
                ) : (
                  filteredLinks.map((link, idx) => {
                    const isSelected = selectedLinkIds.includes(link.id);
                    const domain = getDomainLabel(link.url);
                    const isEditing = editingId === link.id;

                    return (
                      <div
                        key={link.id}
                        className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 shadow-sm ${
                          isEditing
                            ? 'bg-amber-950/30 border-amber-500/50'
                            : isSelected
                            ? 'bg-cyan-950/30 border-cyan-500/50'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {/* Left: Checkbox + Link Metadata */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => handleToggleSelectLink(link.id)}
                            className="p-1 text-slate-400 hover:text-cyan-300 transition cursor-pointer shrink-0"
                            title={isSelected ? 'Deselect link' : 'Select link for sharing'}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-cyan-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                            )}
                          </button>

                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-white truncate max-w-[280px]">
                                {link.name}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-cyan-300 shrink-0">
                                {link.categoryTag || 'General'}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 truncate max-w-[150px]">
                                {domain}
                              </span>
                            </div>

                            {link.description && (
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                {link.description}
                              </p>
                            )}

                            <span className="text-[10px] font-mono text-slate-600 truncate mt-0.5">
                              {link.url}
                            </span>
                          </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Reorder Buttons (if supported) */}
                          {scopeData.onReorder && (
                            <div className="flex items-center gap-0.5 mr-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => scopeData.onReorder && scopeData.onReorder(idx, idx - 1)}
                                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 disabled:opacity-20 cursor-pointer"
                                title="Move link up"
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === scopeData.links.length - 1}
                                onClick={() => scopeData.onReorder && scopeData.onReorder(idx, idx + 1)}
                                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 disabled:opacity-20 cursor-pointer"
                                title="Move link down"
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          {/* Open URL Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenLink(link.url)}
                            className="px-2.5 py-1 bg-cyan-950/80 hover:bg-cyan-900/90 text-cyan-200 border border-cyan-500/40 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            title="Open link in new tab"
                          >
                            <ExternalLink className="w-3 h-3 text-cyan-400" />
                            <span>Open</span>
                          </button>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleStartEdit(link)}
                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-amber-300 rounded-lg transition cursor-pointer"
                            title="Edit Link"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => handleDelete(link)}
                            className="p-1.5 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 rounded-lg transition cursor-pointer"
                            title="Delete Link"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                /* Received Links List */
                filteredLinks.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 bg-slate-950/30 rounded-2xl border border-slate-800/60 text-center">
                    <Inbox className="w-10 h-10 text-slate-600 mb-2" />
                    <p className="text-xs font-bold text-slate-400">No received links in your inbox</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      When other players or the GM share links during session play, they will appear here.
                    </p>
                  </div>
                ) : (
                  filteredLinks.map((item) => {
                    const receivedItem = item as ReceivedLinkItem;
                    const domain = getDomainLabel(receivedItem.url);
                    return (
                      <div
                        key={receivedItem.id}
                        className={`p-3 rounded-xl border transition flex items-center justify-between gap-3 shadow-sm ${
                          !receivedItem.isRead
                            ? 'bg-slate-950 border-cyan-500/60 shadow-cyan-500/10'
                            : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {!receivedItem.isRead && (
                            <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0 animate-pulse" title="Unread" />
                          )}
                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-white truncate max-w-[280px]">
                                {receivedItem.name}
                              </span>
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950/80 border border-indigo-700 text-indigo-300 shrink-0">
                                From: {receivedItem.senderName}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500">
                                {domain}
                              </span>
                            </div>

                            {receivedItem.description && (
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                {receivedItem.description}
                              </p>
                            )}

                            <span className="text-[10px] font-mono text-slate-600 truncate mt-0.5">
                              {receivedItem.url}
                            </span>
                          </div>
                        </div>

                        {/* Received Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Open URL */}
                          <button
                            type="button"
                            onClick={() => handleOpenLink(receivedItem.url, receivedItem.id)}
                            className="px-2.5 py-1 bg-cyan-950/80 hover:bg-cyan-900/90 text-cyan-200 border border-cyan-500/40 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            title="Open link in new tab"
                          >
                            <ExternalLink className="w-3 h-3 text-cyan-400" />
                            <span>Open</span>
                          </button>

                          {/* Save to My Links */}
                          <button
                            type="button"
                            onClick={() => handleSaveReceivedToActiveScope(receivedItem)}
                            className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-200 border border-emerald-500/40 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            title={activeRole === 'gm' ? 'Save to GM Links' : 'Save to Player Links'}
                          >
                            <BookmarkPlus className="w-3 h-3 text-emerald-400" />
                            <span>Save to {activeRole === 'gm' ? 'GM Links' : 'Player Links'}</span>
                          </button>

                          {/* Dismiss / Delete */}
                          <button
                            type="button"
                            onClick={() => deleteReceivedLink(receivedItem.id)}
                            className="p-1.5 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 rounded-lg transition cursor-pointer"
                            title="Dismiss link"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
