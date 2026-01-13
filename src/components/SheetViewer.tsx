import { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FileText,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize
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

// Configurar worker do PDF.js usando CDN para garantir compatibilidade
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

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
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [currentTime, setCurrentTime] = useState(externalCurrentTime || 0);
  const [duration, setDuration] = useState(externalDuration || 0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sheetAreaRef = useRef<HTMLDivElement>(null);

  // Melhor detecção de PDF (incluindo URLs do Supabase que podem não terminar em .pdf)
  const isPdf = useMemo(() => {
    if (!sheetMusicUrl) return false;
    const urlLower = sheetMusicUrl.toLowerCase();
    return urlLower.endsWith('.pdf') || urlLower.includes('pdf') || urlLower.includes('storage/v1/object/public/sheet-music');
  }, [sheetMusicUrl]);

  // Carregar PDF e converter para imagens
  useEffect(() => {
    if (isPdf && sheetMusicUrl) {
      console.log('[SheetViewer] Sheet music URL changed:', sheetMusicUrl);
      console.log('[SheetViewer] Is PDF:', isPdf);
      loadPdfPages(sheetMusicUrl);
    } else if (!isPdf && sheetMusicUrl) {
      console.log('[SheetViewer] Loading image sheet:', sheetMusicUrl);
    }
  }, [sheetMusicUrl, isPdf]);

  const loadPdfPages = async (url: string) => {
    console.log('[SheetViewer] Loading PDF from URL:', url);
    setLoadingPdf(true);
    setPdfError(null);
    setPdfPages([]);
    
    // Timeout de segurança: se o PDF não carregar em 15 segundos, reseta o loading
    const loadingTimeout = setTimeout(() => {
      console.warn('[SheetViewer] PDF loading timeout - resetting loading state');
      setLoadingPdf(false);
      setPdfError('Tempo limite excedido ao carregar PDF');
    }, 15000);
    
    try {
      console.log('[SheetViewer] Fetching PDF document...');
      const pdf = await pdfjsLib.getDocument(url).promise;
      const totalPages = pdf.numPages;
      console.log(`[SheetViewer] PDF loaded with ${totalPages} pages`);
      const pages: string[] = [];

      for (let i = 1; i <= totalPages; i++) {
        console.log(`[SheetViewer] Rendering page ${i}/${totalPages}`);
        const page = await pdf.getPage(i);
        const scale = 2;
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
          console.error(`[SheetViewer] Failed to get canvas context for page ${i}`);
          continue;
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({
          canvasContext: context,
          viewport: viewport,
        } as any).promise;

        pages.push(canvas.toDataURL('image/jpeg', 0.92));
      }

      setPdfPages(pages);
      console.log(`[SheetViewer] Successfully loaded ${pages.length} pages`);
      clearTimeout(loadingTimeout);
    } catch (error: any) {
      console.error('[SheetViewer] Error loading PDF:', error);
      setPdfError(error?.message || 'Erro ao carregar PDF');
      clearTimeout(loadingTimeout);
    } finally {
      setLoadingPdf(false);
      console.log('[SheetViewer] PDF loading finished');
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
    if (audioElement) return; // Usa o elemento externo, não configura listeners
    
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
    if (audioElement) return; // O controle é feito pelo player externo
    
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

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 50));
  };

  const handleResetZoom = () => {
    setZoom(100);
    setRotation(0);
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, pdfPages.length - 1));
  };

  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 0));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        if (currentPage < pdfPages.length - 1) {
          handleNextPage();
        }
      } else {
        if (currentPage > 0) {
          handlePreviousPage();
        }
      }
    }
    setTouchStart(null);
  };

  const currentSheet = isPdf && pdfPages.length > 0 ? pdfPages[currentPage] : sheetMusicUrl;
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

      {/* Header com controles */}
      <div className="relative z-10 border-b border-border/20 bg-black/80 px-4 py-3 backdrop-blur-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={onClose}
              className="h-8 w-8 text-white hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </Button>
            
            <div className="ml-2">
              <p className="text-sm font-semibold text-white">{currentTrack.songName}</p>
              <p className="text-xs text-white/60">{currentTrack.naipe.charAt(0).toUpperCase() + currentTrack.naipe.slice(1).toLowerCase()}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Controles de zoom */}
            <Button
              size="icon"
              variant="ghost"
              onClick={handleZoomOut}
              className="h-8 w-8 text-white hover:bg-white/10"
              disabled={zoom <= 50}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            
            <span className="min-w-[60px] text-center text-xs text-white/80">
              {zoom}%
            </span>
            
            <Button
              size="icon"
              variant="ghost"
              onClick={handleZoomIn}
              className="h-8 w-8 text-white hover:bg-white/10"
              disabled={zoom >= 200}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={handleResetZoom}
              className="h-8 w-8 text-white hover:bg-white/10"
              title="Resetar zoom e rotação"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={toggleFullscreen}
              className="h-8 w-8 text-white hover:bg-white/10"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Área da partitura */}
      <div 
        ref={sheetAreaRef}
        className="relative flex-1 overflow-auto bg-gradient-to-b from-black/90 to-black"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex min-h-full items-center justify-center p-4">
          {loadingPdf ? (
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <div className="text-white">Carregando partitura...</div>
            </div>
          ) : isPdf && pdfPages.length === 0 ? (
            <div className="flex flex-col items-center gap-4 text-white">
              <FileText className="h-16 w-16 text-white/40" />
              <p className="text-white/60">{pdfError || 'Erro ao carregar PDF'}</p>
              {sheetMusicUrl && (
                <Button
                  onClick={() => window.open(sheetMusicUrl, '_blank')}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  Abrir em nova aba
                </Button>
              )}
            </div>
          ) : (
            <div className="relative">
              <img 
                src={currentSheet} 
                alt="Partitura" 
                className="max-w-full shadow-2xl"
                style={{ 
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                  transformOrigin: 'center',
                  transition: 'transform 0.2s ease'
                }}
              />
              
              {/* Navegação de páginas do PDF - Minimalista */}
              {isPdf && pdfPages.length > 1 && (
                <>
                  {currentPage > 0 && (
                    <button
                      onClick={handlePreviousPage}
                      className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center text-white/40 hover:text-white/60 transition-colors"
                      title="Página anterior"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                  )}
                  
                  {currentPage < pdfPages.length - 1 && (
                    <button
                      onClick={handleNextPage}
                      className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center text-white/40 hover:text-white/60 transition-colors"
                      title="Próxima página"
                    >
                      <ChevronRight className="h-6 w-6" />
                    </button>
                  )}

                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur">
                    Página {currentPage + 1} de {pdfPages.length}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Player fixo na parte inferior */}
      <div className="bg-muted p-4">
        <div className="mx-auto max-w-4xl">
          {/* Barra de progresso */}
          <div className="mb-4 flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{formatTime(currentTime)}</span>
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="flex-1"
            />
            <span className="text-xs text-muted-foreground">{formatTime(duration)}</span>
          </div>

          {/* Controles de reprodução */}
          <div className="flex items-center justify-center gap-4">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                if (canGoToPrevTrack) {
                  onTrackSelect(currentTrackIndex - 1);
                }
              }}
              disabled={!canGoToPrevTrack}
              className="h-10 w-10"
            >
              <SkipBack className="h-5 w-5" />
            </Button>

            <Button
              size="icon"
              variant="default"
              onClick={onPlayPause}
              className="h-14 w-14 rounded-full bg-primary hover:scale-105 hover:bg-primary-hover"
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
              className="h-10 w-10"
            >
              <SkipForward className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
