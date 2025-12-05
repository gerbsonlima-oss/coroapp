import { DetectedNote } from '@/hooks/usePitchDetection';
import { Music2 } from 'lucide-react';

interface PitchVisualizerProps {
  notes: DetectedNote[];
  isAnalyzing: boolean;
}

export const PitchVisualizer = ({ notes, isAnalyzing }: PitchVisualizerProps) => {
  const recentNotes = notes.slice(-10);
  const currentNote = notes[notes.length - 1];

  return (
    <div className="space-y-2">
      {isAnalyzing && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Music2 className="h-4 w-4 animate-pulse" />
          <span>Analisando pitch...</span>
        </div>
      )}

      {currentNote && (
        <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
          <div className="text-center">
            <div className="text-4xl font-bold text-primary">
              {currentNote.noteName}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {Math.round(currentNote.pitch)} Hz
            </div>
          </div>
        </div>
      )}

      {recentNotes.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">
            Últimas notas detectadas:
          </div>
          <div className="flex flex-wrap gap-1">
            {recentNotes.map((note, idx) => (
              <span
                key={idx}
                className="px-2 py-1 text-xs bg-secondary rounded"
                style={{
                  opacity: 0.4 + (idx / recentNotes.length) * 0.6
                }}
              >
                {note.noteName}
              </span>
            ))}
          </div>
        </div>
      )}

      {notes.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Total de notas: {notes.length}
        </div>
      )}
    </div>
  );
};
