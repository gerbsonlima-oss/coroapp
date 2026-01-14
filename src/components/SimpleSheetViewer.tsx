import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { 
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

interface SimpleSheetViewerProps {
  sheetMusicUrl: string;
  songName: string;
  onClose: () => void;
}

// Configurar worker do PDF.js usando CDN
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export const SimpleSheetViewer = ({
  sheetMusicUrl,
  songName,
  onClose,
}: SimpleSheetViewerProps) => {
  const [zoom, setZoom] = useState(100);
  const [pdfPages, setPdfPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const isPdf = useMemo(() => {
    if (!sheetMusicUrl) return false;
    const urlLower = sheetMusicUrl.toLowerCase();
    return urlLower.endsWith('.pdf') || urlLower.includes('pdf') || urlLower.includes('storage/v1/object/public/sheet-music');
  }, [sheetMusicUrl]);

  useEffect(() => {
    if (isPdf && sheetMusicUrl) {
      loadPdfPages(sheetMusicUrl);
    }
  }, [sheetMusicUrl, isPdf]);

  const loadPdfPages = async (url: string) => {
    setLoadingPdf(true);
    setPdfError(null);
    setPdfPages([]);
    
    const loadingTimeout = setTimeout(() => {
      setLoadingPdf(false);
      setPdfError('Tempo limite excedido ao carregar PDF');
    }, 15000);
    
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
      clearTimeout(loadingTimeout);
    } catch (error: any) {
      console.error('Error loading PDF:', error);
      setPdfError(error?.message || 'Erro ao carregar PDF');
      clearTimeout(loadingTimeout);
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleResetZoom = () => setZoom(100);

  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, pdfPages.length - 1));
  const handlePreviousPage = () => setCurrentPage(prev => Math.max(prev - 1, 0));

  const handleTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0 && currentPage < pdfPages.length - 1) {
        handleNextPage();
      } else if (diff < 0 && currentPage > 0) {
        handlePreviousPage();
      }
    }
    setTouchStart(null);
  };

  const handleDownload = () => {
    window.open(sheetMusicUrl, '_blank');
  };

  const currentSheet = isPdf && pdfPages.length > 0 ? pdfPages[currentPage] : sheetMusicUrl;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
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
              <p className="text-sm font-semibold text-white">{songName}</p>
              <p className="text-xs text-white/60">Partitura</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={handleZoomOut}
              className="h-8 w-8 text-white hover:bg-white/10"
              disabled={zoom <= 50}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            
            <span className="min-w-[50px] text-center text-xs text-white/80">
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
              title="Resetar zoom"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>

            <Button
              size="icon"
              variant="ghost"
              onClick={handleDownload}
              className="h-8 w-8 text-white hover:bg-white/10"
              title="Baixar PDF"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Sheet Area */}
      <div 
        className="relative flex-1 overflow-auto bg-gradient-to-b from-black/90 to-black"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="flex min-h-full items-center justify-center p-4">
          {loadingPdf ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-white">Carregando partitura...</div>
            </div>
          ) : pdfError ? (
            <div className="flex flex-col items-center gap-4 text-white">
              <p className="text-white/60">{pdfError}</p>
              <Button
                onClick={() => window.open(sheetMusicUrl, '_blank')}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                Abrir em nova aba
              </Button>
            </div>
          ) : isPdf && pdfPages.length === 0 ? (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-white">Carregando...</div>
            </div>
          ) : (
            <div className="relative">
              <img 
                src={currentSheet} 
                alt="Partitura" 
                className="max-w-full shadow-2xl"
                style={{ 
                  transform: `scale(${zoom / 100})`,
                  transformOrigin: 'center',
                  transition: 'transform 0.2s ease'
                }}
              />
              
              {/* Page Navigation */}
              {isPdf && pdfPages.length > 1 && (
                <>
                  {currentPage > 0 && (
                    <button
                      onClick={handlePreviousPage}
                      className="absolute left-0 top-0 bottom-0 w-12 flex items-center justify-center text-white/40 hover:text-white/60 transition-colors"
                    >
                      <ChevronLeft className="h-6 w-6" />
                    </button>
                  )}
                  
                  {currentPage < pdfPages.length - 1 && (
                    <button
                      onClick={handleNextPage}
                      className="absolute right-0 top-0 bottom-0 w-12 flex items-center justify-center text-white/40 hover:text-white/60 transition-colors"
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

      {/* Footer */}
      <div className="shrink-0 px-4 py-3 border-t border-border/20 bg-black/80 flex justify-center">
        <Button
          variant="outline"
          onClick={onClose}
          className="min-w-[120px] border-white/20 text-white hover:bg-white/10"
        >
          Fechar
        </Button>
      </div>
    </div>
  );
};