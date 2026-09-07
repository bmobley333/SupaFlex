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
  return (
    <span className={`inline-flex items-center align-baseline flex-wrap max-w-full ${className}`}>
      {prefix && <span className="mr-1 shrink-0">{prefix}</span>}
      <span className={truncate ? 'truncate' : 'break-words'}>{name}</span>
      <ItemNotesPopover notes={notes} itemName={name} inline />
      {suffix && <span className="ml-1 shrink-0">{suffix}</span>}
    </span>
  );
};
