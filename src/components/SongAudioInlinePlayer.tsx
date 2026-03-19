import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Loader2 } from 'lucide-react';

interface SongAudioInlinePlayerProps {
  audioUrl: string;
  naipe: string;
  name?: string;
}

export const SongAudioInlinePlayer = ({ audioUrl, naipe, name }: SongAudioInlinePlayerProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadStart = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, []);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      try {
        await audio.play();
      } catch (error) {
        console.error('Error playing audio:', error);
      }
    }
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = value[0];
    }
  };

  const formatTime = (time: number): string => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const lowerNaipe = naipe.toLowerCase();
  const naipeColorClass = 
    lowerNaipe === 'soprano' ? 'border-pink-500/40 text-pink-600 dark:text-pink-400 bg-pink-500/5' :
    lowerNaipe === 'contralto' ? 'border-yellow-500/40 text-yellow-600 dark:text-yellow-400 bg-yellow-500/5' :
    lowerNaipe === 'tenor' ? 'border-green-500/40 text-green-600 dark:text-green-400 bg-green-500/5' :
    lowerNaipe === 'baixo' ? 'border-blue-500/40 text-blue-600 dark:text-blue-400 bg-blue-500/5' :
    lowerNaipe === '4 vozes' ? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border-none' :
    'border-primary/40 text-primary bg-primary/5';

  return (
    <div className="flex items-center gap-2 py-1.5">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      
      {/* Play Button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 rounded-full bg-primary/10 hover:bg-primary/20"
        onClick={togglePlay}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-4 w-4 text-primary" />
        ) : (
          <Play className="h-4 w-4 text-primary ml-0.5" />
        )}
      </Button>

      {/* Naipe Badge */}
      <Badge 
        variant={lowerNaipe === '4 vozes' ? "secondary" : "outline"}
        className={`h-5 px-2 text-[10px] font-bold uppercase tracking-wider pointer-events-none shrink-0 ${naipeColorClass}`}
      >
        {naipe}
      </Badge>

      {/* Progress */}
      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="text-[10px] text-muted-foreground w-8 text-right shrink-0">
          {formatTime(currentTime)}
        </span>
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.1}
          onValueChange={handleSeek}
          className="flex-1"
        />
        <span className="text-[10px] text-muted-foreground w-8 shrink-0">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
};
