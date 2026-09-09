// src/components/common/ItemNameWithNotes.tsx
import React from 'react';
import { ItemNotesPopover } from './ItemNotesPopover';

interface ItemNameWithNotesProps {
  name: string;
  notes?: string | null;
  className?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  truncate?: boolean;
}

export const ItemNameWithNotes: React.FC<ItemNameWithNotesProps> = ({
  name,
  notes,
  className = '',
  prefix,
  suffix,
  truncate = false,
}) => {
  const hasNotes = Boolean(notes && notes.trim());

  if (truncate) {
    return (
      <span className={`inline-flex items-center align-baseline max-w-full ${className}`}>
        {prefix && <span className="mr-1 shrink-0">{prefix}</span>}
        <span className="truncate">{name}</span>
        {hasNotes && <ItemNotesPopover notes={notes} itemName={name} inline />}
        {suffix && <span className="ml-1 shrink-0">{suffix}</span>}
      </span>
    );
  }

  const lastSpaceIdx = name.lastIndexOf(' ');
  const prefixText = lastSpaceIdx !== -1 ? name.slice(0, lastSpaceIdx + 1) : '';
  const lastWord = lastSpaceIdx !== -1 ? name.slice(lastSpaceIdx + 1) : name;

  return (
    <span className={`align-baseline leading-tight ${className}`}>
      {prefix && <span className="mr-1 shrink-0">{prefix}</span>}
      {prefixText}
      {hasNotes ? (
        <span className="inline-block whitespace-nowrap">
          {lastWord}
          <ItemNotesPopover notes={notes} itemName={name} inline />
        </span>
      ) : (
        <span>{lastWord}</span>
      )}
      {suffix && <span className="ml-1 shrink-0">{suffix}</span>}
    </span>
  );
};
