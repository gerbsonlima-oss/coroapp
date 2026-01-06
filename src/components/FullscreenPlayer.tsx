import { useEffect, useState } from 'react';
import { X, Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Shuffle, Heart, FileText, MoreVertical, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { usePlayer } from '@/contexts/PlayerContext';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FullscreenPlayerProps {
  currentTime: number;
  duration: number;
  onSeek: (value: number[]) => void;
  sheetMusicUrl?: string | null;
}

export function FullscreenPlayer({ 
  currentTime, 
  duration, 
  onSeek,
  sheetMusicUrl 
}: FullscreenPlayerProps) {
  const {
    currentTrack,
    isPlaying,
    repeatMode,
    playNext,
    playPrevious,
    toggleRepeat,
    togglePlay,
    isExpanded,
    setIsExpanded,
    tracks,
    currentTrackIndex,
  } = usePlayer();

  const [showQueue, setShowQueue] = useState(false);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const formatTime = (time: number) => {
    if (!isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const RepeatIcon = repeatMode === 'track' ? Repeat1 : Repeat;

  // Swipe down to close
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartY === null) return;

    const touchEndY = e.changedTouches[0].clientY;
    const diffY = touchEndY - touchStartY;

    if (diffY > 100) {
      setIsExpanded(false);
    }

    setTouchStartY(null);
  };

  if (!isExpanded || !currentTrack) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] bg-gradient-to-b from-background via-background to-background/95 flex flex-col animate-slide-up"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsExpanded(false)}
          className="touch-target"
        >
          <ChevronDown className="h-6 w-6" />
        </Button>
        
        <div className="text-center flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Reproduzindo do Evento
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="touch-target"
        >
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>

      {/* Swipe indicator */}
      <div className="flex justify-center py-2">
        <div className="w-12 h-1 rounded-full bg-muted-foreground/30" />
      </div>

      <ScrollArea className="flex-1">
        <div className="px-6 pb-6">
          {/* Artwork/Icon Large */}
          <div className="w-full aspect-square max-w-md mx-auto my-8 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-elevated flex items-center justify-center">
            {isPlaying ? (
              <div className="flex gap-3 items-end h-32">
                <div className="w-4 bg-primary rounded-full animate-pulse" style={{ height: '40%', animationDelay: '0ms' }} />
                <div className="w-4 bg-primary rounded-full animate-pulse" style={{ height: '80%', animationDelay: '100ms' }} />
                <div className="w-4 bg-primary rounded-full animate-pulse" style={{ height: '60%', animationDelay: '200ms' }} />
                <div className="w-4 bg-primary rounded-full animate-pulse" style={{ height: '90%', animationDelay: '300ms' }} />
                <div className="w-4 bg-primary rounded-full animate-pulse" style={{ height: '50%', animationDelay: '400ms' }} />
              </div>
            ) : (
              <FileText className="w-24 h-24 text-primary/40" />
            )}
          </div>

          {/* Song Info */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2 px-4">
              {currentTrack.songName}
            </h1>
            <p className="text-lg text-muted-foreground">
              {currentTrack.naipe}
            </p>
          </div>

          {/* Progress */}
          <div className="mb-8">
            <Slider
              value={[currentTime]}
              min={0}
              max={duration || 100}
              step={0.1}
              onValueChange={onSeek}
              className="cursor-pointer h-2 [&>span]:h-2 [&_[role=slider]]:h-5 [&_[role=slider]]:w-5 [&_[role=slider]]:border-2 [&_[role=slider]]:shadow-lg"
            />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground font-medium">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Main Controls */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={playPrevious}
              className="h-14 w-14 hover:bg-accent/80 active:scale-95 transition-all"
            >
              <SkipBack className="h-7 w-7" />
            </Button>

            <Button
              variant="default"
              size="icon"
              onClick={togglePlay}
              className="h-20 w-20 rounded-full hover:scale-105 active:scale-95 transition-all shadow-glow"
            >
              {isPlaying ? (
                <Pause className="h-10 w-10" />
              ) : (
                <Play className="h-10 w-10 ml-1" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={playNext}
              className="h-14 w-14 hover:bg-accent/80 active:scale-95 transition-all"
            >
              <SkipForward className="h-7 w-7" />
            </Button>
          </div>

          {/* Secondary Controls */}
          <div className="flex items-center justify-between px-4 mb-8">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleRepeat}
              className={cn(
                "h-12 w-12",
                repeatMode !== 'off' && "text-primary"
              )}
            >
              <RepeatIcon className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12"
            >
              <Heart className="h-5 w-5" />
            </Button>

            {sheetMusicUrl && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.open(sheetMusicUrl, '_blank')}
                className="h-12 w-12"
              >
                <FileText className="h-5 w-5" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowQueue(!showQueue)}
              className={cn(
                "h-12 w-12",
                showQueue && "text-primary"
              )}
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>

          {/* Queue */}
          {showQueue && tracks.length > 0 && (
            <div className="border-t border-border pt-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4 px-2">
                Próximas Músicas
              </h3>
              <div className="space-y-2">
                {tracks.slice(currentTrackIndex + 1, currentTrackIndex + 6).map((track, index) => (
                  <div
                    key={track.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <span className="text-xs text-muted-foreground w-6 text-center">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{track.songName}</p>
                      <p className="text-xs text-muted-foreground truncate">{track.naipe}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}