import { DetectedNote } from '@/hooks/usePitchDetection';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Download } from 'lucide-react';
import { toast } from 'sonner';

interface SheetMusicNotationProps {
  notes: DetectedNote[];
}

export const SheetMusicNotation = ({ notes }: SheetMusicNotationProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!canvasRef.current || notes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size with zoom
    const container = canvas.parentElement;
    if (container) {
      const baseWidth = Math.max(800, notes.length * 50);
      canvas.width = baseWidth * zoom;
      canvas.height = 400 * zoom;
      ctx.scale(zoom, zoom);
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Constants
    const staffLineSpacing = 20;
    const staffTop = 100;
    const noteSpacing = 40;
    const leftMargin = 40;

    // Draw staff lines
    ctx.strokeStyle = 'hsl(var(--foreground) / 0.3)';
    ctx.lineWidth = 1;
    
    for (let i = 0; i < 5; i++) {
      const y = staffTop + i * staffLineSpacing;
      ctx.beginPath();
      ctx.moveTo(leftMargin, y);
      ctx.lineTo(canvas.width - 40, y);
      ctx.stroke();
    }

    // Draw treble clef (simplified)
    ctx.font = 'bold 60px serif';
    ctx.fillStyle = 'hsl(var(--foreground))';
    ctx.fillText('𝄞', leftMargin - 5, staffTop + staffLineSpacing * 3);

    // Note position mapping (C4 to C6)
    const notePositions: { [key: string]: number } = {
      'C6': staffTop - staffLineSpacing * 2,
      'B5': staffTop - staffLineSpacing * 1.5,
      'A5': staffTop - staffLineSpacing,
      'G5': staffTop - staffLineSpacing * 0.5,
      'F5': staffTop,
      'E5': staffTop + staffLineSpacing * 0.5,
      'D5': staffTop + staffLineSpacing,
      'C5': staffTop + staffLineSpacing * 1.5,
      'B4': staffTop + staffLineSpacing * 2,
      'A4': staffTop + staffLineSpacing * 2.5,
      'G4': staffTop + staffLineSpacing * 3,
      'F4': staffTop + staffLineSpacing * 3.5,
      'E4': staffTop + staffLineSpacing * 4,
      'D4': staffTop + staffLineSpacing * 4.5,
      'C4': staffTop + staffLineSpacing * 5,
      'B3': staffTop + staffLineSpacing * 5.5,
      'A3': staffTop + staffLineSpacing * 6,
    };

    // Group similar consecutive notes
    const groupedNotes: Array<{ note: string; count: number; avgPitch: number }> = [];
    let currentGroup = { note: notes[0].noteName, count: 1, avgPitch: notes[0].pitch };

    for (let i = 1; i < notes.length; i++) {
      if (notes[i].noteName === currentGroup.note && i - groupedNotes.reduce((acc, g) => acc + g.count, 0) < 3) {
        currentGroup.count++;
        currentGroup.avgPitch = (currentGroup.avgPitch + notes[i].pitch) / 2;
      } else {
        groupedNotes.push({ ...currentGroup });
        currentGroup = { note: notes[i].noteName, count: 1, avgPitch: notes[i].pitch };
      }
    }
    groupedNotes.push(currentGroup);

    // Draw notes
    ctx.fillStyle = 'hsl(var(--primary))';
    ctx.strokeStyle = 'hsl(var(--primary))';
    ctx.lineWidth = 2;

    const maxNotesPerLine = Math.floor((canvas.width - leftMargin - 40) / noteSpacing);
    let noteIndex = 0;

    groupedNotes.forEach((group, idx) => {
      if (idx >= maxNotesPerLine) return; // Limit to visible notes

      const x = leftMargin + 80 + idx * noteSpacing;
      const y = notePositions[group.note] || staffTop + staffLineSpacing * 2;

      // Draw note head (oval)
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.3);
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Draw stem
      ctx.beginPath();
      ctx.moveTo(x + 7, y);
      ctx.lineTo(x + 7, y - 30);
      ctx.stroke();

      // Draw ledger lines if needed
      if (y < staffTop - staffLineSpacing || y > staffTop + staffLineSpacing * 4) {
        ctx.strokeStyle = 'hsl(var(--foreground) / 0.3)';
        ctx.lineWidth = 1;
        const ledgerY = Math.round(y / staffLineSpacing) * staffLineSpacing;
        ctx.beginPath();
        ctx.moveTo(x - 12, ledgerY);
        ctx.lineTo(x + 12, ledgerY);
        ctx.stroke();
        ctx.strokeStyle = 'hsl(var(--primary))';
        ctx.lineWidth = 2;
      }

      // Draw note name below staff
      ctx.font = '11px sans-serif';
      ctx.fillStyle = 'hsl(var(--muted-foreground))';
      ctx.textAlign = 'center';
      ctx.fillText(group.note, x, staffTop + staffLineSpacing * 5 + 20);

      noteIndex++;
    });

    // Draw title
    ctx.font = 'bold 16px sans-serif';
    ctx.fillStyle = 'hsl(var(--foreground))';
    ctx.textAlign = 'left';
    ctx.fillText('Partitura Transcrita', leftMargin, staffTop - 50);

    // Draw note count
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'hsl(var(--muted-foreground))';
    ctx.fillText(
      `${groupedNotes.length} ${groupedNotes.length === 1 ? 'nota' : 'notas'}`,
      leftMargin,
      staffTop - 30
    );

  }, [notes, zoom]);

  const handleZoomIn = () => {
    if (zoom < 2) {
      setZoom(prev => Math.min(2, prev + 0.25));
      toast.info('Zoom aumentado');
    }
  };

  const handleZoomOut = () => {
    if (zoom > 0.5) {
      setZoom(prev => Math.max(0.5, prev - 0.25));
      toast.info('Zoom reduzido');
    }
  };

  const handleDownloadImage = () => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    canvas.toBlob((blob) => {
      if (!blob) return;
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `partitura_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Imagem da partitura baixada!');
    });
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            className="h-9 w-9 rounded-lg"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[60px] text-center font-medium">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomIn}
            disabled={zoom >= 2}
            className="h-9 w-9 rounded-lg"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadImage}
          className="rounded-lg"
        >
          <Download className="h-4 w-4 mr-2" />
          Baixar Imagem
        </Button>
      </div>

      {/* Sheet Music Canvas */}
      <div 
        ref={containerRef}
        className="w-full overflow-x-auto overflow-y-hidden rounded-xl border border-border bg-background/50 shadow-sm"
        style={{ 
          scrollbarWidth: 'thin',
          scrollbarColor: 'hsl(var(--muted)) hsl(var(--background))'
        }}
      >
        <canvas
          ref={canvasRef}
          className="block"
          style={{ 
            minHeight: '400px',
            imageRendering: 'crisp-edges'
          }}
        />
      </div>

      {/* Info Footer */}
      {notes.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-2">
          <span>
            {notes.length} {notes.length === 1 ? 'nota detectada' : 'notas detectadas'}
          </span>
          <span className="hidden sm:inline">
            Role horizontalmente para ver toda a partitura
          </span>
        </div>
      )}
    </div>
  );
};