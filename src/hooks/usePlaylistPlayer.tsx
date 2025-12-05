import { useState, useCallback, useRef } from 'react';

export type RepeatMode = 'off' | 'playlist' | 'track';

export interface Track {
  id: string;
  songId: string;
  songName: string;
  songType: string;
  naipe: string;
  url: string;
}

export const usePlaylistPlayer = (tracks: Track[]) => {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const currentTrack = tracks[currentTrackIndex] || null;

  const playTrack = useCallback((index: number) => {
    if (index >= 0 && index < tracks.length) {
      setCurrentTrackIndex(index);
      setIsPlaying(true);
    }
  }, [tracks.length]);

  const playNext = useCallback(() => {
    if (repeatMode === 'track') {
      // Repete a música atual - mantém o estado de playing e deixa o componente lidar com isso
      setIsPlaying(true);
      return;
    }

    const nextIndex = currentTrackIndex + 1;
    
    if (nextIndex < tracks.length) {
      playTrack(nextIndex);
    } else if (repeatMode === 'playlist') {
      // Volta para o início da playlist
      playTrack(0);
    } else {
      // Para no final da playlist
      setIsPlaying(false);
    }
  }, [currentTrackIndex, tracks.length, repeatMode, playTrack]);

  const playPrevious = useCallback(() => {
    const prevIndex = currentTrackIndex - 1;
    if (prevIndex >= 0) {
      playTrack(prevIndex);
    } else if (repeatMode === 'playlist') {
      // Vai para o final da playlist
      playTrack(tracks.length - 1);
    }
  }, [currentTrackIndex, tracks.length, repeatMode, playTrack]);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((current) => {
      if (current === 'off') return 'playlist';
      if (current === 'playlist') return 'track';
      return 'off';
    });
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const setAudioElement = useCallback((audio: HTMLAudioElement | null) => {
    audioRef.current = audio;
  }, []);

  return {
    currentTrack,
    currentTrackIndex,
    isPlaying,
    repeatMode,
    playTrack,
    playNext,
    playPrevious,
    toggleRepeat,
    togglePlay,
    setIsPlaying,
    setAudioElement,
    totalTracks: tracks.length,
  };
};
