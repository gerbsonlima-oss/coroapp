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
          setSavedPreferences({
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

  // Save preferences to database (explicit save)
  const savePreferences = useCallback(async (transpose: number, fontSize: number) => {
    if (!user?.id || !songId) return false;

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

      setSavedPreferences({ transpose, fontSize });
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
