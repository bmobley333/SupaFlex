// src/store/useGenreStore.ts
// Centralized Zustand store for global Genre filtering in SupaFlex

import { create } from 'zustand';

export type GenreType = 'All' | 'Medieval' | 'Modern' | 'SciFi' | 'GuildSpace';

interface GenreStore {
  activeGenre: GenreType;
  setActiveGenre: (genre: GenreType) => void;
  resetGenre: () => void;
}

const STORAGE_KEY = 'supaflex_active_genre';

const getInitialGenre = (): GenreType => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'Medieval' || saved === 'Modern' || saved === 'SciFi' || saved === 'GuildSpace' || saved === 'All') {
      return saved;
    }
  }
  return 'All';
};

export const useGenreStore = create<GenreStore>((set) => ({
  activeGenre: getInitialGenre(),
  setActiveGenre: (genre: GenreType) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, genre);
    }
    set({ activeGenre: genre });
  },
  resetGenre: () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'All');
    }
    set({ activeGenre: 'All' });
  },
}));

/**
 * Helper utility to test if a row's genre array or string matches the active genre filter.
 */
export function matchesGenre(
  rowGenres: string[] | string | null | undefined,
  activeGenre: GenreType
): boolean {
  // If active filter is 'All', match everything
  if (activeGenre === 'All') return true;
  
  // If item has no genre defined, default to visible
  if (!rowGenres) return true;

  let genresArray: string[] = [];

  if (Array.isArray(rowGenres)) {
    genresArray = rowGenres;
  } else if (typeof rowGenres === 'string') {
    try {
      const parsed = JSON.parse(rowGenres);
      if (Array.isArray(parsed)) {
        genresArray = parsed;
      } else {
        genresArray = [rowGenres];
      }
    } catch {
      genresArray = [rowGenres];
    }
  }

  if (genresArray.length === 0) return true;

  const activeLower = activeGenre.toLowerCase();
  
  return genresArray.some((g) => {
    if (!g) return false;
    const gLower = strNormalized(g);
    return gLower === activeLower || gLower === 'all' || gLower === 'universal';
  });
}

function strNormalized(val: string): string {
  return String(val).trim().toLowerCase();
}
