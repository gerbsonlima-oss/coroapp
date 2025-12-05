import { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Music2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAudioCache } from '@/hooks/useAudioCache';

export function MiniPlayer() {
  const {
    currentTrack,
    isPlaying,
    repeatMode,
    playNext,
    playPrevious,
    toggleRepeat,
    togglePlay,
    setIsPlaying,
    setAudioElement,
    setIsExpanded,
  } = usePlayer();

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [audioSrc, setAudioSrc] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { getCachedUrl } = useAudioCache();

  // Não renderiza se não há track
  if (!currentTrack) {
    return null;
  }

  // Load audio source
  useEffect(() => {
    const loadAudioSource = async () => {
      if (!currentTrack) return;
      
      setIsLoading(true);
      try {
        const cachedUrl = await getCachedUrl(currentTrack.url);
        setAudioSrc(cachedUrl);
      } catch (error) {
        console.error('Error loading audio:', error);
        setAudioSrc(currentTrack.url);
      } finally {
        setIsLoading(false);
      }
    };

    loadAudioSource();
  }, [currentTrack, getCachedUrl]);

  // Set audio element ref
  useEffect(() => {
    if (audioRef.current) {
      setAudioElement(audioRef.current);
    }
  }, [setAudioElement]);

  // Handle play/pause
  useEffect(() => {
    if (!audioRef.current || isLoading) return;

    if (isPlaying) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error('Error playing audio:', error);
          setIsPlaying(false);
        });
      }
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, isLoading, setIsPlaying]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => playNext();
    const handleCanPlay = () => setIsLoading(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [playNext]);

  const handleSeek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const formatTime = (time: number) => {
    if (!isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const RepeatIcon = repeatMode === 'track' ? Repeat1 : Repeat;

  return (
    <>
      <audio ref={audioRef} src={audioSrc} preload="metadata" />
      
      <div className="fixed bottom-[72px] left-0 right-0 z-50 border-t border-border/50 bg-background/90 backdrop-blur-xl shadow-elevated">
        {/* Progress bar no topo - área de toque maior */}
        <div className="px-4 pt-3 pb-1">
          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="cursor-pointer touch-action-pan-y"
          />
        </div>

        <div className="px-4 pb-3 pt-1">
          <div className="flex items-center gap-3">
            {/* Info da música */}
            <button
              onClick={() => setIsExpanded(true)}
              className="flex-1 flex items-center gap-3 min-w-0 text-left hover:opacity-80 transition-opacity active:scale-95"
            >
              <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shadow-subtle">
                <Music2 className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{currentTrack.songName}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {currentTrack.naipe} • {formatTime(currentTime)} / {formatTime(duration)}
                </p>
              </div>
            </button>

            {/* Controles */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={playPrevious}
                className="h-9 w-9 hover:bg-accent/80 active:scale-95"
              >
                <SkipBack className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlay}
                disabled={isLoading}
                className="h-10 w-10 hover:bg-accent/80 active:scale-95"
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={playNext}
                className="h-9 w-9 hover:bg-accent/80 active:scale-95"
              >
                <SkipForward className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleRepeat}
                className={`h-9 w-9 hover:bg-accent/80 active:scale-95 ${repeatMode !== 'off' ? 'text-primary' : ''}`}
              >
                <RepeatIcon className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsExpanded(true)}
                className="h-9 w-9 hover:bg-accent/80 active:scale-95"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
