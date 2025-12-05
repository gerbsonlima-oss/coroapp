import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Volume2, VolumeX, AlertCircle, Download, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAudioCache } from '@/hooks/useAudioCache';

interface AudioPlayerProps {
  src: string;
  naipe: string;
  showDownloadButton?: boolean;
}

export const AudioPlayer = ({ src, naipe, showDownloadButton = false }: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [audioSrc, setAudioSrc] = useState(src);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { isCached, cacheAudio, getCachedUrl } = useAudioCache();

  useEffect(() => {
    loadAudioSource();
  }, [src]);

  const loadAudioSource = async () => {
    const cachedUrl = await getCachedUrl(src);
    setAudioSrc(cachedUrl);
  };

  const handleDownload = async () => {
    setIsLoading(true);
    const success = await cacheAudio(src);
    if (success) {
      toast.success(`${naipe} disponível offline!`);
      loadAudioSource();
    } else {
      toast.error(`Erro ao baixar ${naipe}`);
    }
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
    const handleEnded = () => setIsPlaying(false);
    const handleError = () => {
      setError('Erro ao carregar áudio');
      setIsLoading(false);
      setIsPlaying(false);
      toast.error(`Erro ao carregar áudio de ${naipe}`);
    };
    const handleCanPlay = () => {
      setIsLoading(false);
      setError(null);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
    };
  }, [naipe]);

  // Ao ficar offline, tenta trocar para a fonte cacheada automaticamente
  useEffect(() => {
    const handleOffline = () => {
      loadAudioSource();
    };
    window.addEventListener('offline', handleOffline);
    return () => window.removeEventListener('offline', handleOffline);
  }, [src]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio || error) return;

    try {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        // Garante usar a fonte offline se já estiver cacheada
        if (isCached(src) && !audioSrc.startsWith('blob:')) {
          await loadAudioSource();
        }
        await audio.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Erro ao reproduzir áudio:', err);
      // Fallback imediato: se houver cache, force trocar para blob e tente de novo
      try {
        if (isCached(src)) {
          await loadAudioSource();
          await audio.play();
          setIsPlaying(true);
          setError(null);
          return;
        }
      } catch {}
      toast.error(`Não foi possível reproduzir o áudio de ${naipe}`);
      setIsPlaying(false);
      setError('Erro ao reproduzir');
    }
  };

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

  if (error) {
    return (
      <div className="space-y-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">{naipe}</span>
          <AlertCircle className="h-4 w-4 text-destructive" />
        </div>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  const cached = isCached(src);

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card/50 p-4">
      <audio ref={audioRef} src={audioSrc} preload="metadata" crossOrigin="anonymous" />
      
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{naipe}</span>
          {cached && (
            <span title="Disponível offline">
              <Check className="h-4 w-4 text-green-500" />
            </span>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {isLoading ? 'Carregando...' : `${formatTime(currentTime)} / ${formatTime(duration)}`}
        </span>
      </div>

      <Slider
        value={[currentTime]}
        max={duration || 100}
        step={0.1}
        onValueChange={handleSeek}
        className="w-full"
        disabled={isLoading || error !== null}
      />

      <div className="flex items-center gap-3">
        <Button
          size="icon"
          variant="outline"
          onClick={togglePlay}
          className="h-10 w-10 rounded-full"
          disabled={isLoading || error !== null}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>

        <div className="flex flex-1 items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={toggleMute}
            className="h-8 w-8"
            disabled={isLoading || error !== null}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
          <Slider
            value={[isMuted ? 0 : volume]}
            max={1}
            step={0.01}
            onValueChange={handleVolumeChange}
            className="w-20"
            disabled={isLoading || error !== null}
          />
        </div>

        {showDownloadButton && !cached && (
          <Button
            size="icon"
            variant="outline"
            onClick={handleDownload}
            className="h-10 w-10"
            disabled={isLoading || error !== null}
            title="Baixar para offline"
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};