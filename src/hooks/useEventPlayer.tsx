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
  const { getCachedUrl } = useAudioCache();
  const audioRef = useRef<HTMLAudioElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const isOggUrl = (url: string) => /\.ogg($|[?#])/i.test(url);
  const browserSupportsOgg = (audio: HTMLAudioElement) =>
    Boolean(audio.canPlayType('audio/ogg; codecs="opus"') || audio.canPlayType('audio/ogg'));
  const dispatchAudioError = (message: string, track: Track | null) => {
    window.dispatchEvent(new CustomEvent('audio-error', { detail: { message, track } }));
  };
  const revokeBlobUrl = () => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  };

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

  const buildFallbackBlobUrl = useCallback(async (url: string) => {
    const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const blob = await response.blob();
    const fallbackBlob = blob.type && blob.type !== 'application/octet-stream'
      ? blob
      : new Blob([await blob.arrayBuffer()], { type: 'audio/mpeg' });

    revokeBlobUrl();
    const blobUrl = URL.createObjectURL(fallbackBlob);
    blobUrlRef.current = blobUrl;
    return blobUrl;
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
    console.log('[Player] playNext called. Current index:', currentTrackIndex, 'Total tracks:', tracks.length);
    
    if (state.repeatMode === 'track' && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.error('[Player] Error in playNext track repeat:', e));
      setIsPlaying(true);
      return;
    }

    const nextIndex = currentTrackIndex + 1;

    if (nextIndex < tracks.length) {
      console.log('[Player] Advancing to next track:', nextIndex);
      playTrack(nextIndex);
    } else if (state.repeatMode === 'playlist' && tracks.length > 0) {
      console.log('[Player] Looping back to first track');
      playTrack(0);
    } else {
      console.log('[Player] End of playlist reached');
      setIsPlaying(false);
    }
  }, [currentTrackIndex, state.repeatMode, tracks, playTrack]);

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
        audioRef.current.play().catch((err) => {
          if (err?.name !== 'AbortError') {
            console.error('Erro ao reproduzir:', err);
            setIsPlaying(false);
          }
        });
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
      console.log('[Player] Metadata loaded');
      setDuration(audio.duration);
      setIsLoading(false);
    };

    const handleEnded = () => {
      console.log('[Player] Audio ended, handling next playback...');
      if (state.repeatMode === 'track') {
        audio.currentTime = 0;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            if (err.name !== 'AbortError') console.error('[Player] Error re-playing track:', err);
          });
        }
      } else {
        // Pequeno delay para garantir que o estado do navegador se estabilize após o fim do áudio
        setTimeout(() => {
          playNext();
        }, 100);
      }
    };

    const handleCanPlay = () => {
      console.log('[Player] Can play - resetting loading state');
      setIsLoading(false);
    };

    const handlePlay = () => {
      console.log('[Player] Playing');
      setIsPlaying(true);
      setIsLoading(false);
    };
    
    const handlePause = () => {
      console.log('[Player] Paused');
      setIsPlaying(false);
    };

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
      let message = errorMessages[errorCode] || 'Erro ao reproduzir áudio';
      if (currentTrack?.url && isOggUrl(currentTrack.url) && !browserSupportsOgg(audioTarget)) {
        message = 'Este navegador não suporta este áudio .ogg. Tente Chrome/Firefox ou use MP3/M4A.';
      }

      dispatchAudioError(message, currentTrack);
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
  }, [state.repeatMode, playNext]);

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

    let loadingTimeout: NodeJS.Timeout;

    const loadTrackAsync = async () => {
      if (!audioRef.current) return;
      
      console.log('[Player] Loading track:', currentTrack.songName, '-', currentTrack.naipe);
      
      try {
        // Obtém a URL cacheada (ou original se não estiver em cache)
        const cachedUrl = await getCachedUrl(currentTrack.url);
        const audioEl = audioRef.current;
        const currentSrc = audioEl.src;

        if (isOggUrl(cachedUrl) && !browserSupportsOgg(audioEl)) {
          console.warn('[Player] Browser does not support OGG/Opus:', cachedUrl);
          setIsPlaying(false);
          setIsLoading(false);
          dispatchAudioError('Este navegador nao suporta este audio .ogg. Tente Chrome/Firefox ou use MP3/M4A.', currentTrack);
          return;
        }
        
        console.log('[Player] Current src:', currentSrc);
        console.log('[Player] New src:', cachedUrl);
        
        // Só atualiza se a URL mudou
        const shouldForceReload =
          !!audioEl.error ||
          audioEl.readyState === 0 ||
          audioEl.networkState === audioEl.NETWORK_NO_SOURCE;

        if (currentSrc !== cachedUrl || shouldForceReload) {
          setIsLoading(true);
          
          // Timeout de segurança: se o áudio não carregar em 10 segundos, reseta o loading
          loadingTimeout = setTimeout(() => {
            console.warn('[Player] Loading timeout - resetting loading state');
            setIsLoading(false);
          }, 10000);
          
          // Pause e reset antes de mudar a source
          audioEl.pause();
          audioEl.currentTime = 0;
          audioEl.src = cachedUrl;
          audioEl.load();
          
          console.log('[Player] Source updated to:', cachedUrl);
          
          // Se estava tocando, tenta tocar a nova source
          if (state.isPlaying) {
            console.log('[Player] Resuming playback after source change');
            const playPromise = audioEl.play();
            if (playPromise !== undefined) {
              playPromise.catch(async (err) => {
                if (err.name !== 'AbortError') {
                  console.error('[Player] Error playing after load:', err);
                  if (err.name === 'NotSupportedError') {
                    try {
                      const fallbackUrl = await buildFallbackBlobUrl(cachedUrl);
                      audioEl.src = fallbackUrl;
                      audioEl.load();
                      await audioEl.play();
                      clearTimeout(loadingTimeout);
                      return;
                    } catch (fallbackError) {
                      console.error('[Player] Blob fallback failed:', fallbackError);
                    }
                  }
                  setIsPlaying(false);
                  setIsLoading(false);
                  clearTimeout(loadingTimeout);
                }
              });
            }
          }
        } else {
          console.log('[Player] Source unchanged, skipping reload');
          // Se a source não mudou e não está carregando, pode tocar imediatamente
          if (state.isPlaying && audioEl.paused) {
            audioEl.play().catch(async err => {
              if (err.name !== 'AbortError') {
                console.error('[Player] Error playing:', err);
                if (err.name === 'NotSupportedError') {
                  try {
                    const fallbackUrl = await buildFallbackBlobUrl(cachedUrl);
                    audioEl.src = fallbackUrl;
                    audioEl.load();
                    await audioEl.play();
                    return;
                  } catch (fallbackError) {
                    console.error('[Player] Blob fallback failed:', fallbackError);
                  }
                }
                if (isOggUrl(cachedUrl) && !browserSupportsOgg(audioEl)) {
                  dispatchAudioError(
                    'Este navegador nao suporta este audio .ogg. Tente Chrome/Firefox ou use MP3/M4A.',
                    currentTrack
                  );
                }
                setIsPlaying(false);
              }
            });
          }
        }
      } catch (error) {
        console.error('[Player] Error loading track:', error);
        setIsLoading(false);
        setIsPlaying(false);
        if (loadingTimeout) clearTimeout(loadingTimeout);
      }
    };

    loadTrackAsync();

    return () => {
      if (loadingTimeout) clearTimeout(loadingTimeout);
    };
  }, [currentTrack?.id, getCachedUrl, buildFallbackBlobUrl]);

  // ✅ Handle filter changes - if current track no longer exists in playlist
  useEffect(() => {
    if (state.currentTrackId && currentTrackIndex === -1 && tracks.length > 0) {
      // Current track not found in filtered playlist - switch to first track
      playTrack(0);
    }
  }, [tracks.length, state.currentTrackId, currentTrackIndex, playTrack]);

  useEffect(() => {
    return () => {
      revokeBlobUrl();
    };
  }, []);

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
