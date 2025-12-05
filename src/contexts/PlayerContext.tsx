import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { usePlaylistPlayer, Track } from '@/hooks/usePlaylistPlayer';

interface PlayerContextType {
  tracks: Track[];
  setPlaylist: (tracks: Track[], startIndex?: number) => void;
  clearPlaylist: () => void;
  currentTrack: Track | null;
  currentTrackIndex: number;
  isPlaying: boolean;
  repeatMode: 'off' | 'playlist' | 'track';
  playTrack: (index: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  toggleRepeat: () => void;
  togglePlay: () => void;
  setIsPlaying: (playing: boolean) => void;
  setAudioElement: (audio: HTMLAudioElement | null) => void;
  totalTracks: number;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
}

const PlayerContext = createContext<PlayerContextType | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  
  const player = usePlaylistPlayer(tracks);

  const setPlaylist = useCallback((newTracks: Track[], startIndex = 0) => {
    setTracks(newTracks);
    if (newTracks.length > 0) {
      // Pequeno delay para garantir que os tracks foram atualizados
      setTimeout(() => {
        player.playTrack(startIndex);
      }, 100);
    }
  }, [player]);

  const clearPlaylist = useCallback(() => {
    setTracks([]);
    player.setIsPlaying(false);
  }, [player]);

  return (
    <PlayerContext.Provider
      value={{
        tracks,
        setPlaylist,
        clearPlaylist,
        currentTrack: player.currentTrack,
        currentTrackIndex: player.currentTrackIndex,
        isPlaying: player.isPlaying,
        repeatMode: player.repeatMode,
        playTrack: player.playTrack,
        playNext: player.playNext,
        playPrevious: player.playPrevious,
        toggleRepeat: player.toggleRepeat,
        togglePlay: player.togglePlay,
        setIsPlaying: player.setIsPlaying,
        setAudioElement: player.setAudioElement,
        totalTracks: player.totalTracks,
        isExpanded,
        setIsExpanded,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider');
  }
  return context;
}
