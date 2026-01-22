import { useState } from 'react';
import { LyricsExportOptions } from '@/components/ExportLyricsDialog';

const STORAGE_KEY = 'lyrics-export-preferences';

const defaultOptions: LyricsExportOptions = {
  fontSize: 11,
  fontFamily: 'times',
  margin: 18,
  gutter: 12,
};

export const useExportPreferences = () => {
  const [preferences] = useState<LyricsExportOptions>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...defaultOptions, ...JSON.parse(saved) } : defaultOptions;
    } catch {
      return defaultOptions;
    }
  });

  const savePreferences = (newPreferences: LyricsExportOptions) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPreferences));
    } catch (e) {
      console.warn('Failed to save export preferences:', e);
    }
  };

  return { preferences, savePreferences };
};
