import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  X
} from 'lucide-react';
import type { Track } from '@/hooks/usePlaylistPlayer';
import * as pdfjsLib from 'pdfjs-dist';

interface SheetViewerProps {
  currentTrack: Track;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onClose: () => void;
  onTrackEnd: () => void;
  sheetMusicUrl: string;
  allTracks: Track[];
  currentTrackIndex: number;
  onTrackSelect: (index: number) => void;
  audioElement?: HTMLAudioElement | null;
  currentTime?: number;
  duration?: number;
}

// Configurar worker do PDF.js
const pdfWorker = new Worker(
  new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
  { type: 'module' }
);
(pdfjsLib as any).GlobalWorkerOptions.workerPort = pdfWorker;

export const SheetViewer = ({
  currentTrack,
  isPlaying,
  onPlayPause,
  onNext,
  onPrevious,
  onClose,
  onTrackEnd,
  sheetMusicUrl,
  allTracks,
  currentTrackIndex,
  onTrackSelect,
  audioElement,
  currentTime: externalCurrentTime,
  duration: externalDuration,
}: SheetViewerProps) => {
  const [currentTime, setCurrentTime] = useState(externalCurrentTime || 0);
  const [duration, setDuration] = useState(externalDuration || 0);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [loadingPdf, setLoadingPdf] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const isPdf = sheetMusicUrl?.toLowerCase().endsWith('.pdf');

  // Carregar PDF e converter para imagens
  useEffect(() => {
    if (isPdf && sheetMusicUrl) {
      loadPdfPages(sheetMusicUrl);
    }
  }, [sheetMusicUrl, isPdf]);

  const loadPdfPages = async (url: string) => {
    setLoadingPdf(true);
    try {
      const pdf = await pdfjsLib.getDocument(url).promise;
      const totalPages = pdf.numPages;
      const pages: string[] = [];

      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const scale = 2;
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) continue;

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        } as any).promise;

        pages.push(canvas.toDataURL('image/jpeg', 0.92));
      }

      setPdfPages(pages);
    } catch (error) {
      console.error('Erro ao carregar PDF:', error);
    } finally {
      setLoadingPdf(false);
    }
  };

  // Sincronizar com tempo/duração externos quando fornecidos
  useEffect(() => {
    if (externalCurrentTime !== undefined) {
      setCurrentTime(externalCurrentTime);
    }
  }, [externalCurrentTime]);

  useEffect(() => {
    if (externalDuration !== undefined) {
      setDuration(externalDuration);
    }
  }, [externalDuration]);

  // Configurar áudio - só se não houver elemento externo
  useEffect(() => {
    if (audioElement) return;
    
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => onTrackEnd();

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [onTrackEnd, audioElement]);

  // Play/Pause - não controla o áudio se houver elemento externo
  useEffect(() => {
    if (audioElement) return;
    
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(err => console.error('Erro ao reproduzir:', err));
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack.id, audioElement]);

  const handleSeek = (value: number[]) => {
    const audio = audioElement || audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const canGoToPrevTrack = currentTrackIndex > 0;
  const canGoToNextTrack = currentTrackIndex < allTracks.length - 1;

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Só renderiza o elemento de áudio se não houver um externo */}
      {!audioElement && (
        <audio 
          ref={audioRef} 
          src={currentTrack.url} 
          preload="metadata" 
          crossOrigin="anonymous"
        />
      )}

      {/* Header minimalista */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/80 to-transparent">
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          className="h-10 w-10 text-white hover:bg-white/20 rounded-full"
        >
          <X className="h-5 w-5" />
        </Button>
        
        <div className="text-center flex-1 mx-4">
          <p className="text-sm font-semibold text-white truncate">{currentTrack.songName}</p>
          <p className="text-xs text-white/60">{currentTrack.naipe.charAt(0).toUpperCase() + currentTrack.naipe.slice(1).toLowerCase()}</p>
        </div>

        <div className="w-10" /> {/* Spacer para centralizar o título */}
      </div>

      {/* Área da partitura com scroll e pinch-to-zoom */}
      <div 
        className="flex-1 overflow-auto overscroll-contain"
        style={{ 
          touchAction: 'pan-x pan-y pinch-zoom',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        {loadingPdf ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-white text-sm">Carregando partitura...</div>
          </div>
        ) : isPdf && pdfPages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-white p-4">
            <p className="text-white/60 text-sm">Erro ao carregar PDF</p>
            <Button
              onClick={() => window.open(sheetMusicUrl, '_blank')}
              variant="outline"
              size="sm"
              className="border-white/20 text-white hover:bg-white/10"
            >
              Abrir em nova aba
            </Button>
          </div>
        ) : (
          <div className="pb-32 px-2">
            {isPdf && pdfPages.length > 0 ? (
              // Renderiza todas as páginas do PDF em sequência vertical
              pdfPages.map((page, index) => (
                <img 
                  key={index}
                  src={page} 
                  alt={`Página ${index + 1}`} 
                  className="w-full h-auto block"
                  draggable={false}
                />
              ))
            ) : (
              // Imagem única
              <img 
                src={sheetMusicUrl} 
                alt="Partitura" 
                className="w-full h-auto block"
                draggable={false}
              />
            )}
          </div>
        )}
      </div>

      {/* Player fixo na parte inferior - minimalista */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black via-black/95 to-transparent pt-8 pb-4 px-4">
        <div className="max-w-md mx-auto space-y-3">
          {/* Barra de progresso */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-white/60 min-w-[32px] text-right">{formatTime(currentTime)}</span>
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="flex-1"
            />
            <span className="text-[10px] text-white/60 min-w-[32px]">{formatTime(duration)}</span>
          </div>

          {/* Controles de reprodução */}
          <div className="flex items-center justify-center gap-6">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                if (canGoToPrevTrack) {
                  onTrackSelect(currentTrackIndex - 1);
                }
              }}
              disabled={!canGoToPrevTrack}
              className="h-10 w-10 text-white hover:bg-white/20 disabled:opacity-30"
            >
              <SkipBack className="h-5 w-5" />
            </Button>

            <Button
              size="icon"
              variant="default"
              onClick={onPlayPause}
              className="h-14 w-14 rounded-full bg-white text-black hover:bg-white/90"
            >
              {isPlaying ? (
                <Pause className="h-6 w-6" />
              ) : (
                <Play className="ml-1 h-6 w-6" />
              )}
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                if (canGoToNextTrack) {
                  onTrackSelect(currentTrackIndex + 1);
                }
              }}
              disabled={!canGoToNextTrack}
              className="h-10 w-10 text-white hover:bg-white/20 disabled:opacity-30"
            >
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
