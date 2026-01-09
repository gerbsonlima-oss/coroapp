import { useState, useCallback, useRef, useEffect } from 'react';
import { useAudioCache } from './useAudioCache';

export type RepeatMode = 'off' | 'playlist' | 'track';

export interface Track {
  id: string;
  songId: string;
  songName: string;
  songType: string;
  naipe: string;
  url: string;
  sheetMusicUrl?: string | null;
}

export interface PlayerState {
  currentTrackId: string | null;  // ✅ Changed from index to ID
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  repeatMode: RepeatMode;
  isLoading: boolean;
  volume: number;
  isMuted: boolean;
}

export const useEventPlayer = (tracks: Track[]) => {
  const { getCachedUrl, isCached } = useAudioCache();
  const audioRef = useRef<HTMLAudioElement>(null);

  // ✅ SINGLE SOURCE OF TRUTH - All player state consolidated
  const [state, setState] = useState<PlayerState>({
    currentTrackId: null,
    currentTime: 0,
    duration: 0,
    isPlaying: false,
    repeatMode: 'off',
    isLoading: false,
    volume: 1,
    isMuted: false,
  });

  // ✅ Calculate currentTrackIndex dynamically based on current tracks
  const currentTrackIndex = state.currentTrackId 
    ? tracks.findIndex(t => t.id === state.currentTrackId)
    : -1;
  
  const currentTrack = tracks[currentTrackIndex] || null;

  // =====================
  // State Update Actions
  // =====================

  const setCurrentTime = useCallback((time: number) => {
    setState(prev => ({ ...prev, currentTime: time }));
  }, []);

  const setDuration = useCallback((duration: number) => {
    setState(prev => ({ ...prev, duration }));
  }, []);

  const setIsPlaying = useCallback((playing: boolean) => {
    setState(prev => ({ ...prev, isPlaying: playing }));
  }, []);

  const setIsLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, isLoading: loading }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    setState(prev => ({
      ...prev,
      volume,
      isMuted: volume === 0,
    }));
  }, []);

  const toggleMute = useCallback(() => {
    setState(prev => {
      const newMuted = !prev.isMuted;
      if (audioRef.current) {
        audioRef.current.volume = newMuted ? 0 : (prev.volume || 0.5);
      }
      return {
        ...prev,
        isMuted: newMuted,
        volume: newMuted ? 0 : prev.volume,
      };
    });
  }, []);

  // =====================
  // Playback Actions
  // =====================

  const playTrack = useCallback((index: number) => {
    if (index >= 0 && index < tracks.length) {
      const track = tracks[index];
      setState(prev => ({
        ...prev,
        currentTrackId: track.id,
        isPlaying: true,
      }));
    }
  }, [tracks]);

  const playNext = useCallback(() => {
    if (state.repeatMode === 'track') {
      // Repeat current track - reset and play
      setIsPlaying(true);
      return;
    }

    const nextIndex = (currentTrackIndex || 0) + 1;

    if (nextIndex < tracks.length) {
      playTrack(nextIndex);
    } else if (state.repeatMode === 'playlist') {
      // Loop back to beginning
      playTrack(0);
    } else {
      // Stop at end
      setIsPlaying(false);
    }
  }, [currentTrackIndex, state.repeatMode, tracks.length, playTrack]);

  const playPrevious = useCallback(() => {
    const prevIndex = (currentTrackIndex || 0) - 1;
    
    if (prevIndex >= 0) {
      playTrack(prevIndex);
    } else if (state.repeatMode === 'playlist') {
      // Loop to end
      playTrack(tracks.length - 1);
    }
  }, [currentTrackIndex, state.repeatMode, tracks.length, playTrack]);

  const toggleRepeat = useCallback(() => {
    setState(prev => ({
      ...prev,
      repeatMode: prev.repeatMode === 'off' 
        ? 'playlist' 
        : prev.repeatMode === 'playlist' 
        ? 'track' 
        : 'off',
    }));
  }, []);

  const togglePlay = useCallback(() => {
    if (audioRef.current) {
      if (state.isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
    }
  }, [state.isPlaying]);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  // =====================
  // Audio Element Sync
  // =====================

  // Sync state with audio element playback
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleEnded = () => {
      if (state.repeatMode === 'track') {
        audio.currentTime = 0;
        audio.play();
      } else {
        playNext();
      }
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    const handleError = (e: Event) => {
      const audioTarget = e.target as HTMLAudioElement;
      console.error('Audio error:', audioTarget.error);
      setIsLoading(false);
      setIsPlaying(false);
      
      // Show user-friendly error message
      const errorMessages: Record<number, string> = {
        1: 'Erro ao carregar áudio',
        2: 'Erro de rede ao carregar áudio',
        3: 'Formato de áudio não suportado',
        4: 'Áudio não encontrado ou inacessível'
      };
      const errorCode = audioTarget.error?.code || 4;
      const message = errorMessages[errorCode] || 'Erro ao reproduzir áudio';
      
      // We'll emit a custom event that can be caught by the UI
      window.dispatchEvent(new CustomEvent('audio-error', { detail: { message, track: currentTrack } }));
    };

    const handleStalled = () => {
      console.warn('Audio stalled');
    };

    const handleWaiting = () => {
      setIsLoading(true);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('canplaythrough', () => setIsLoading(false));
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);
    audio.addEventListener('playing', () => setIsLoading(false));
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('stalled', handleStalled);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('canplaythrough', () => setIsLoading(false));
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('playing', () => setIsLoading(false));
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('stalled', handleStalled);
    };
  }, [state.repeatMode, state.isPlaying, playNext]);

  // Handle play/pause state change
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || state.isLoading) return;

    const isActuallyPlaying = !audio.paused;
    
    if (state.isPlaying && !isActuallyPlaying) {
      audio.play().catch(err => {
        if (err.name === 'AbortError') return;
        console.error('Erro ao reproduzir:', err);
        setIsPlaying(false);
      });
    } else if (!state.isPlaying && isActuallyPlaying) {
      audio.pause();
    }
  }, [state.isPlaying, state.isLoading]);

  // Handle track change
  useEffect(() => {
    if (!currentTrack || !audioRef.current) return;

    const loadTrackAsync = async () => {
      if (!audioRef.current) return;
      
      const cachedUrl = await getCachedUrl(currentTrack.url);
      
      if (audioRef.current.getAttribute('src') !== cachedUrl) {
        setIsLoading(true);
        
        try {
          // Pause and reset before source change
          audioRef.current.pause();
          audioRef.current.src = cachedUrl;
          audioRef.current.load();
          
          // If we were playing, try to play the new source
          if (state.isPlaying) {
            audioRef.current.play().catch(err => {
              if (err.name !== 'AbortError') console.error('Erro ao reproduzir após carga:', err);
            });
          }
        } catch (error) {
          console.error('Error loading track:', error);
          setIsLoading(false);
        }
      }
    };

    loadTrackAsync();
  }, [currentTrack?.id, getCachedUrl]);

  // ✅ Handle filter changes - if current track no longer exists in playlist
  useEffect(() => {
    if (state.currentTrackId && currentTrackIndex === -1 && tracks.length > 0) {
      // Current track not found in filtered playlist - switch to first track
      playTrack(0);
    }
  }, [tracks.length, state.currentTrackId, currentTrackIndex, playTrack]);

  // =====================
  // Return API
  // =====================

  return {
    // State
    state,
    currentTrack,
    currentTrackIndex,

    // Refs
    audioRef,

    // Playback Actions
    playTrack,
    playNext,
    playPrevious,
    toggleRepeat,
    togglePlay,
    seek,

    // Volume Actions
    setVolume,
    toggleMute,

    // Utilities
    totalTracks: tracks.length,
  };
};
