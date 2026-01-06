import { createContext, useContext, ReactNode, useMemo, useState } from 'react';
import { useEventPlayer, type Track } from '@/hooks/useEventPlayer';

export interface PlayerContextType {
  // State
  currentTrack: Track | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  isLoading: boolean;
  repeatMode: 'off' | 'playlist' | 'track';
  volume: number;
  isMuted: boolean;
  currentTrackIndex: number;
  isExpanded: boolean;
  tracks: Track[];
  
  // Refs
  audioRef: React.RefObject<HTMLAudioElement>;
  
  // Actions
  playTrack: (index: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  toggleRepeat: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaylist: (tracks: Track[]) => void;
  setIsExpanded: (expanded: boolean) => void;
  setIsPlaying?: (playing: boolean) => void;
  setAudioElement?: (audio: HTMLAudioElement | null) => void;
  setCurrentTime?: (time: number) => void;
  setDuration?: (duration: number) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export const PlayerProvider = ({ children }: { children: ReactNode }) => {
  const [playlist, setPlaylistState] = useState<Track[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const {
    state: playerState,
    currentTrack,
    currentTrackIndex,
    audioRef,
    playTrack,
    playNext,
    playPrevious,
    toggleRepeat,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
  } = useEventPlayer(playlist);

  const { currentTime, duration, isPlaying, repeatMode, isLoading, volume, isMuted } = playerState;

  // ✅ Memoize o valor do contexto
  const contextValue = useMemo<PlayerContextType>(() => ({
    currentTrack,
    currentTime,
    duration,
    isPlaying,
    isLoading,
    repeatMode,
    volume,
    isMuted,
    currentTrackIndex,
    isExpanded,
    tracks: playlist,
    audioRef,
    playTrack,
    playNext,
    playPrevious,
    toggleRepeat,
    togglePlay,
    seek,
    setVolume,
    toggleMute,
    setPlaylist: setPlaylistState,
    setIsExpanded,
  }), [
    currentTrack,
    currentTime,
    duration,
    isPlaying,
    isLoading,
    repeatMode,
    volume,
    isMuted,
    currentTrackIndex,
    isExpanded,
    playlist,
  ]);

  return (
    <PlayerContext.Provider value={contextValue}>
      {children}
      <audio 
        ref={audioRef}
        preload="metadata"
        crossOrigin="anonymous"
        className="hidden"
      />
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer must be used within PlayerProvider');
  }
  return context;
};
