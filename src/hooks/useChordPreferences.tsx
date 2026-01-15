import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface ChordPreferences {
  transpose: number;
  fontSize: number;
}

const DEFAULT_PREFERENCES: ChordPreferences = {
  transpose: 0,
  fontSize: 16,
};

export const useChordPreferences = (songId: string | undefined) => {
  const { user } = useAuth();
  const [savedPreferences, setSavedPreferences] = useState<ChordPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load preferences from database or local storage
  useEffect(() => {
    const loadPreferences = async () => {
      if (!songId) {
        setIsLoading(false);
        return;
      }

      // Try local storage first as a quick fallback or if not logged in
      const localPrefs = localStorage.getItem(`chord_prefs_${songId}`);
      if (localPrefs) {
        try {
          const parsed = JSON.parse(localPrefs);
          setSavedPreferences(parsed);
        } catch (e) {
          console.error('Error parsing local chord preferences');
        }
      }

      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_chord_preferences')
          .select('transpose, font_size')
          .eq('user_id', user.id)
          .eq('song_id', songId)
          .maybeSingle();

        if (error) {
          console.error('Error loading chord preferences:', error);
        } else if (data) {
          const cloudPrefs = {
            transpose: data.transpose,
            fontSize: data.font_size,
          };
          setSavedPreferences(cloudPrefs);
          // Sync local storage with cloud
          localStorage.setItem(`chord_prefs_${songId}`, JSON.stringify(cloudPrefs));
        }
      } catch (err) {
        console.error('Error loading chord preferences:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [user?.id, songId]);

  // Save preferences to database or local storage
  const savePreferences = useCallback(async (transpose: number, fontSize: number) => {
    if (!songId) return false;

    const newPrefs = { transpose, fontSize };
    
    // Always save to local storage for instant persistence
    localStorage.setItem(`chord_prefs_${songId}`, JSON.stringify(newPrefs));
    setSavedPreferences(newPrefs);

    if (!user?.id) return true;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('user_chord_preferences')
        .upsert(
          {
            user_id: user.id,
            song_id: songId,
            transpose,
            font_size: fontSize,
          },
          {
            onConflict: 'user_id,song_id',
          }
        );

      if (error) {
        console.error('Error saving chord preferences:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error saving chord preferences:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [user?.id, songId]);

  return {
    savedTranspose: savedPreferences.transpose,
    savedFontSize: savedPreferences.fontSize,
    savePreferences,
    isLoading,
    isSaving,
    isAuthenticated: !!user,
  };
};
