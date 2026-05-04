import { useState, useCallback } from 'react';
import { LyricsExportOptions } from '@/components/ExportLyricsDialog';

const STORAGE_KEY = 'lyrics-export-preferences';

const defaultOptions: LyricsExportOptions = {
  fontSize: 11,
  fontFamily: 'times',
  margin: 18,
  gutter: 12,
  theme: undefined, // Will use event theme by default
};

export const useExportPreferences = () => {
  const [preferences, setPreferences] = useState<LyricsExportOptions>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...defaultOptions, ...JSON.parse(saved) } : defaultOptions;
    } catch {
      return defaultOptions;
    }
  });

  const savePreferences = useCallback((newPreferences: LyricsExportOptions) => {
    try {
      // Não persistir as imagens de capa (grandes e específicas por exportação)
      const { coverDataUrl, backCoverDataUrl, ...persistable } = newPreferences;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
      setPreferences(newPreferences);
    } catch (e) {
      console.warn('Failed to save export preferences:', e);
    }
  }, []);

  return { preferences, savePreferences };
};
