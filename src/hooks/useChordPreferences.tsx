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
  const [preferences, setPreferences] = useState<ChordPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences from database
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user?.id || !songId) {
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
          setPreferences({
            transpose: data.transpose,
            fontSize: data.font_size,
          });
        }
      } catch (err) {
        console.error('Error loading chord preferences:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadPreferences();
  }, [user?.id, songId]);

  // Save preferences to database
  const savePreferences = useCallback(async (newPreferences: Partial<ChordPreferences>) => {
    if (!user?.id || !songId) return;

    const updatedPreferences = { ...preferences, ...newPreferences };
    setPreferences(updatedPreferences);

    try {
      const { error } = await supabase
        .from('user_chord_preferences')
        .upsert(
          {
            user_id: user.id,
            song_id: songId,
            transpose: updatedPreferences.transpose,
            font_size: updatedPreferences.fontSize,
          },
          {
            onConflict: 'user_id,song_id',
          }
        );

      if (error) {
        console.error('Error saving chord preferences:', error);
      }
    } catch (err) {
      console.error('Error saving chord preferences:', err);
    }
  }, [user?.id, songId, preferences]);

  const setTranspose = useCallback((transpose: number) => {
    savePreferences({ transpose });
  }, [savePreferences]);

  const setFontSize = useCallback((fontSize: number) => {
    savePreferences({ fontSize });
  }, [savePreferences]);

  const resetPreferences = useCallback(() => {
    savePreferences(DEFAULT_PREFERENCES);
  }, [savePreferences]);

  return {
    transpose: preferences.transpose,
    fontSize: preferences.fontSize,
    setTranspose,
    setFontSize,
    resetPreferences,
    isLoading,
    isAuthenticated: !!user,
  };
};
