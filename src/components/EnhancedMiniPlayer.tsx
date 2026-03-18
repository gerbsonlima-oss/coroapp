import { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Repeat, Repeat1, Music2, Maximize2, MoreVertical, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { usePlayer } from '@/contexts/PlayerContext';
import { useAudioCache } from '@/hooks/useAudioCache';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function EnhancedMiniPlayer() {
  const {
    currentTrack,
    isPlaying,
    repeatMode,
    playNext,
    playPrevious,
    toggleRepeat,
    togglePlay,
    currentTime,
    duration,
    isLoading,
    seek,
    setShowSheetViewer,
    setSheetMusicSrc,
  } = usePlayer();

  const { getCachedUrl, isCached } = useAudioCache();
  const isOnline = useOnlineStatus();
  const [isExpanded, setIsExpanded] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  // Não renderiza se não há track
  if (!currentTrack) {
    return null;
  }

  const handleSeek = (value: number[]) => {
    seek(value[0]);
  };

  const formatTime = (time: number) => {
    if (!isFinite(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const RepeatIcon = repeatMode === 'track' ? Repeat1 : Repeat;

  // Swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null || touchStartY === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchStartX - touchEndX;
    const diffY = touchStartY - touchEndY;

    // Swipe up to expand
    if (Math.abs(diffY) > Math.abs(diffX) && diffY > 50) {
      setIsExpanded(true);
    }
    // Swipe right to previous
    else if (Math.abs(diffX) > Math.abs(diffY) && diffX < -80) {
      playPrevious();
    }
    // Swipe left to next
    else if (Math.abs(diffX) > Math.abs(diffY) && diffX > 80) {
      playNext();
    }

    setTouchStartX(null);
    setTouchStartY(null);
  };

  return (
    <>
      <div 
        className="fixed bottom-[68px] left-0 right-0 z-50 border-t bg-background/98 backdrop-blur-xl shadow-elevated transition-transform duration-300"
        style={{ 
          borderColor: 'hsl(var(--player-border))',
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Enhanced Progress bar */}
        <div className="px-4 pt-2 group">
          <div className="flex justify-between text-[10px] mb-1 font-medium text-muted-foreground tabular-nums opacity-80 group-hover:opacity-100 transition-opacity">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <Slider
            value={[currentTime]}
            min={0}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="cursor-pointer"
          />
        </div>

        {/* Player Info e Controles */}
        <div className="px-4 pb-4 pt-1">
          <div className="flex items-center gap-3">
            {/* Info da música - clicável para expandir */}
            <button
              onClick={() => setIsExpanded(true)}
              className="flex-1 flex items-center gap-3 min-w-0 text-left hover:opacity-80 transition-opacity active:scale-[0.98] touch-target"
            >
              {/* Ícone/Artwork */}
              <div 
                onClick={async (e) => {
                  if (currentTrack.sheetMusicUrl) {
                    e.stopPropagation();
                    const cached = await getCachedUrl(currentTrack.sheetMusicUrl);
                    setSheetMusicSrc(cached);
                    setShowSheetViewer(true);
                  }
                }}
                className={cn(
                  "flex-shrink-0 w-12 h-12 rounded-lg border flex items-center justify-center shadow-subtle transition-all",
                  currentTrack.sheetMusicUrl 
                    ? "bg-primary/20 border-primary/40 hover:bg-primary/30 cursor-pointer active:scale-90" 
                    : "bg-primary/15 border-primary/20"
                )}
              >
                {isPlaying ? (
                  <div className="flex gap-0.5 items-end h-4">
                    <div className="w-1 bg-primary animate-pulse" style={{ height: '40%', animationDelay: '0ms' }} />
                    <div className="w-1 bg-primary animate-pulse" style={{ height: '80%', animationDelay: '150ms' }} />
                    <div className="w-1 bg-primary animate-pulse" style={{ height: '60%', animationDelay: '300ms' }} />
                    <div className="w-1 bg-primary animate-pulse" style={{ height: '90%', animationDelay: '450ms' }} />
                  </div>
                ) : (
                  <Music2 className="w-5 h-5 text-primary" />
                )}
              </div>

              {/* Texto da música */}
              <div className="flex-1 min-w-0">
                <div className="marquee-container flex items-center gap-2">
                  <p className="text-sm font-semibold truncate">{currentTrack.songName}</p>
                  {isCached(currentTrack.url) && (
                    <div className="flex items-center gap-1 shrink-0" title={isOnline ? 'Disponível offline' : 'Reproduzindo offline'}>
                      <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-500" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                  <span>{currentTrack.naipe}</span>
                  <span className="text-[10px]">•</span>
                  <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
                </p>
              </div>
            </button>

            {/* Controles Principais - botões maiores */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={playPrevious}
                className={cn(
                  "touch-target hover:bg-accent/80 active:scale-95 transition-transform",
                  "disabled:opacity-50"
                )}
                disabled={isLoading}
              >
                <SkipBack className="h-5 w-5" />
              </Button>

              <Button
                variant="default"
                size="icon"
                onClick={togglePlay}
                disabled={isLoading}
                className={cn(
                  "touch-target-comfortable hover:scale-105 active:scale-95 transition-all shadow-glow",
                  "disabled:opacity-50"
                )}
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6 ml-0.5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={playNext}
                className={cn(
                  "touch-target hover:bg-accent/80 active:scale-95 transition-transform",
                  "disabled:opacity-50"
                )}
                disabled={isLoading}
              >
                <SkipForward className="h-5 w-5" />
              </Button>

              {/* Menu de opções secundárias */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="touch-target hover:bg-accent/80 active:scale-95 transition-transform"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={toggleRepeat} className="gap-2">
                    <RepeatIcon className={cn(
                      "h-4 w-4",
                      repeatMode !== 'off' && "text-primary"
                    )} />
                    <span>
                      {repeatMode === 'off' && 'Repetir: Desligado'}
                      {repeatMode === 'playlist' && 'Repetir: Playlist'}
                      {repeatMode === 'track' && 'Repetir: Música'}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsExpanded(true)} className="gap-2">
                    <Maximize2 className="h-4 w-4" />
                    <span>Expandir Player</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Indicador de swipe */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-muted-foreground/20" />
      </div>
    </>
  );
}