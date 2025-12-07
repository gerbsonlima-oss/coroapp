
import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Repeat, 
  Repeat1,
  Volume2, 
  VolumeX,
  Download,
  Check,
  Expand,
  X,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAudioCache } from '@/hooks/useAudioCache';
import type { Track, RepeatMode } from '@/hooks/usePlaylistPlayer';

interface PlaylistPlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  repeatMode: RepeatMode;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onToggleRepeat: () => void;
  onTrackEnd: () => void;
  onSetAudioElement: (audio: HTMLAudioElement | null) => void;
  showDownloadButton?: boolean;
  sheetMusicUrl?: string | null;
}

export const PlaylistPlayer = ({
  currentTrack,
  isPlaying,
  repeatMode,
  onPlayPause,
  onNext,
  onPrevious,
  onToggleRepeat,
  onTrackEnd,
  onSetAudioElement,
  showDownloadButton = true,
  sheetMusicUrl = null,
}: PlaylistPlayerProps) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [audioSrc, setAudioSrc] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isControlsExpanded, setIsControlsExpanded] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { isCached, cacheAudio, getCachedUrl } = useAudioCache();

  useEffect(() => {
    if (audioRef.current) {
      onSetAudioElement(audioRef.current);
    }
  }, [onSetAudioElement]);

  useEffect(() => {
    if (currentTrack) {
      loadAudioSource(currentTrack.url);
    }
  }, [currentTrack?.url]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioSrc) return;

    const playSafely = async () => {
      if (isPlaying && !isLoading) {
        try {
          if (currentTrack && isCached(currentTrack.url) && !audioSrc.startsWith('blob:')) {
            const cachedUrl = await getCachedUrl(currentTrack.url);
            if (cachedUrl !== audioSrc) {
              setAudioSrc(cachedUrl);
            }
          }
          await audio.play();
        } catch (err) {
          console.error('Erro ao reproduzir:', err);
          try {
            if (currentTrack && isCached(currentTrack.url)) {
              const cachedUrl = await getCachedUrl(currentTrack.url);
              setAudioSrc(cachedUrl);
              await audio.play();
              return;
            }
          } catch {}
        }
      } else {
        audio.pause();
      }
    };

    playSafely();
  }, [isPlaying, currentTrack?.id, audioSrc, isLoading]);

  const loadAudioSource = async (url: string) => {
    setIsLoading(true);
    const cachedUrl = await getCachedUrl(url);
    setAudioSrc(cachedUrl);
  };

  const handleDownload = async () => {
    if (!currentTrack) return;
    setIsLoading(true);
    await cacheAudio(currentTrack.url);
    loadAudioSource(currentTrack.url);
    setIsLoading(false);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      setDuration(audio.duration);
      setIsLoading(false);
    };
    const handleEnded = () => {
      if (repeatMode === 'track') {
        audio.currentTime = 0;
        audio.play();
        return;
      }
      onTrackEnd();
    };
    const handleCanPlay = () => {
      setIsLoading(false);
      if (isPlaying) {
        audio.play().catch(err => console.error('Erro ao reproduzir:', err));
      }
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', () => setIsLoading(false));

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [onTrackEnd, isPlaying, repeatMode]);

  useEffect(() => {
    const handleOffline = () => {
      if (currentTrack) {
        loadAudioSource(currentTrack.url);
      }
    };
    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, [currentTrack?.url]);

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newVolume = value[0];
    audio.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    if (isMuted) {
      audio.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!currentTrack) {
    return (
      <div className="fixed bottom-16 left-0 right-0 bg-background border-t border-border flex items-center justify-center h-20 text-muted-foreground">
        Nenhuma música selecionada
      </div>
    );
  }

  const cached = isCached(currentTrack.url);
  const hasSheetMusic = !!sheetMusicUrl;
  const isPdfSheetMusic = sheetMusicUrl?.toLowerCase().endsWith('.pdf');

  if (isExpanded && hasSheetMusic) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        <div className="absolute top-4 right-4 z-10">
          <Button
            size="icon"
            variant="outline"
            onClick={() => setIsExpanded(false)}
            className="h-10 w-10 bg-background/80 backdrop-blur"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-auto p-4 pb-24">
          <div className="max-w-4xl mx-auto h-full">
            {isPdfSheetMusic ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <FileText className="h-16 w-16 text-muted-foreground" />
                <p className="text-center text-muted-foreground">
                  Partitura em formato PDF
                </p>
                <Button
                  onClick={() => window.open(sheetMusicUrl, '_blank')}
                  variant="outline"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Abrir PDF em nova aba
                </Button>
              </div>
            ) : (
              <img 
                src={sheetMusicUrl} 
                alt="Partitura" 
                className="w-full h-auto"
              />
            )}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t border-border p-3">
          <audio 
            ref={audioRef} 
            src={audioSrc} 
            preload="metadata" 
            crossOrigin="anonymous"
          />
          
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{currentTrack.songName}</p>
                <p className="text-xs text-muted-foreground truncate">{currentTrack.naipe.charAt(0).toUpperCase() + currentTrack.naipe.slice(1).toLowerCase()}</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onPrevious}
                  className="h-8 w-8"
                  disabled={isLoading}
                >
                  <SkipBack className="h-4 w-4" />
                </Button>

                <Button
                  size="icon"
                  variant="default"
                  onClick={onPlayPause}
                  className="h-10 w-10 rounded-full"
                  disabled={isLoading}
                >
                  {isPlaying ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4 ml-0.5" />
                  )}
                </Button>

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onNext}
                  className="h-8 w-8"
                  disabled={isLoading}
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-[80px] justify-end">
                <span>{formatTime(currentTime)}</span>
                <span>/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="mt-2">
              <Slider
                value={[currentTime]}
                max={duration || 100}
                onValueChange={handleSeek}
                disabled={isLoading}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border z-40 flex flex-col justify-end transition-all duration-300", isControlsExpanded ? "h-[112px]" : "h-[64px]")}>
      <audio 
        ref={audioRef} 
        src={audioSrc} 
        preload="metadata" 
        crossOrigin="anonymous"
      />
      <div className="px-4 py-3 flex items-center justify-between h-full">
        <div className="flex items-center justify-between w-full h-full gap-4">
          {/* Coluna 1: Informações da Música */}
          <div className="min-w-0 cursor-pointer" onClick={() => setIsControlsExpanded(prev => !prev)}>
            <p className="font-medium text-sm truncate">{currentTrack.songName}</p>
            <p className="text-xs text-muted-foreground truncate">{currentTrack.naipe.charAt(0).toUpperCase() + currentTrack.naipe.slice(1).toLowerCase()}</p>
          </div>

          {/* Coluna 2: Controles Principais */}
          <div className="flex items-center justify-center gap-2 shrink-0">
            <Button size="icon" variant="ghost" onClick={onPlayPause} disabled={isLoading} className="h-10 w-10">
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={onNext} disabled={isLoading} className="h-10 w-10">
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>

          {/* Coluna 3: Controles Secundários e Volume */}
          <div className="flex items-center justify-end gap-3 hidden sm:flex">
            <Button size="icon" variant="ghost" onClick={onToggleRepeat} disabled={isLoading} className="h-9 w-9">
              {repeatMode === 'track' ? <Repeat1 className="h-5 w-5 text-primary" /> : <Repeat className="h-5 w-5" />}
            </Button>
            {hasSheetMusic && (
              <Button size="icon" variant="ghost" onClick={() => setIsExpanded(true)} className="h-9 w-9">
                <Expand className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Barra de Progresso e Tempo */}
        <div className="flex items-center gap-2 absolute top-0 left-0 right-0 h-1">
          
          <Slider
            value={[currentTime]}
            max={duration || 100}
            onValueChange={handleSeek}
            disabled={isLoading}
            className="flex-1"
          />
          
        </div>
      </div>
      
      {/* Controles Secundários (Visível apenas quando expandido) */}
      {isControlsExpanded && (
        <div className="px-4 py-2 flex items-center justify-between border-t border-border h-12">
          <div className="flex items-center gap-4">
            <Button size="icon" variant="ghost" onClick={onPrevious} disabled={isLoading} className="h-9 w-9">
              <SkipBack className="h-5 w-5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={onToggleRepeat} disabled={isLoading} className="h-9 w-9">
              {repeatMode === 'track' ? <Repeat1 className="h-5 w-5 text-primary" /> : <Repeat className="h-5 w-5" />}
            </Button>
            {hasSheetMusic && (
              <Button size="icon" variant="ghost" onClick={() => setIsExpanded(true)} className="h-9 w-9">
                <Expand className="h-5 w-5" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
