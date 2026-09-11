// src/components/common/TraitNameWithNotes.tsx
import React from 'react';
import { ItemNotesPopover } from './ItemNotesPopover';

interface TraitNameWithNotesProps {
  name: string;
  notes?: string | null;
  isMso?: boolean;
  icon?: string | null; // e.g. '🌌' or '🧬' or null to suppress icon
  className?: string;
}

export const TraitNameWithNotes: React.FC<TraitNameWithNotesProps> = ({
  name,
  notes,
  isMso = false,
  icon,
  className = '',
}) => {
  const cleanName = (name || '').trim();
  const parts = cleanName.split(/\s+/);
  const lastWord = parts.length > 1 ? parts.pop()! : cleanName;
  const prefix = parts.length > 0 && parts[0] !== '' ? parts.join(' ') : '';

  const displayIcon = icon !== undefined ? icon : isMso ? '🌌' : '🧬';

  return (
    <span className={`font-outfit font-bold text-xs leading-tight inline ${className}`}>
      {displayIcon && <span className="mr-1 select-none">{displayIcon}</span>}
      {prefix ? `${prefix} ` : ''}
      <span className="whitespace-nowrap inline-block">
        <span>{lastWord}</span>
        <ItemNotesPopover notes={notes} itemName={cleanName} inline />
      </span>
    </span>
  );
};
