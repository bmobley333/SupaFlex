// src/utils/tableGroupUtils.ts
// Compatibility shim for kitUtils.ts (Re-exports kit utilities as tableGroup utilities)

import {
  parseKit,
  isTraitItem as isKitTraitItem,
  cleanKitName,
  matchesKitFilter,
  getUniqueBaseKits,
  ParsedKit,
} from './kitUtils';

export type ParsedTableGroup = ParsedKit;

export const parseTableGroup = parseKit;
export const isTraitItem = isKitTraitItem;
export const cleanTableGroupName = cleanKitName;
export const matchesTableGroupFilter = matchesKitFilter;
export const getUniqueBaseTableGroups = getUniqueBaseKits;

export * from './kitUtils';

