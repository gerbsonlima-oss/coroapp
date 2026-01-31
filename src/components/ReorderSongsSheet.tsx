import { useState, useEffect } from 'react';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { GripVertical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface EventSong {
  id: string;
  event_song_id: string;
  name: string;
  type: string;
}

interface ReorderSongsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  songs: EventSong[];
  typeLabels: Record<string, string>;
  onReorderComplete: () => void;
}

// Converte número para romano
const toRoman = (num: number): string => {
  const romanNumerals: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  
  let result = '';
  let remaining = num;
  
  for (const [value, numeral] of romanNumerals) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }
  
  return result;
};

// Gera labels com numeração romana para tipos repetidos
const getSongsWithRomanLabels = (
  songs: EventSong[],
  typeLabels: Record<string, string>
): { song: EventSong; displayLabel: string }[] => {
  // Conta ocorrências de cada tipo
  const typeCounts: Record<string, number> = {};
  songs.forEach(song => {
    const type = song.type || 'outro';
    typeCounts[type] = (typeCounts[type] || 0) + 1;
  });
  
  // Rastreia o índice atual de cada tipo
  const typeCurrentIndex: Record<string, number> = {};
  
  return songs.map(song => {
    const type = song.type || 'outro';
    const baseLabel = getTypeLabel(type, typeLabels);
    const totalOfType = typeCounts[type];
    
    // Inicializa índice se necessário
    if (typeCurrentIndex[type] === undefined) {
      typeCurrentIndex[type] = 0;
    }
    
    typeCurrentIndex[type]++;
    
    // Se houver mais de um do mesmo tipo, adiciona numeral romano
    const displayLabel = totalOfType > 1 
      ? `${baseLabel} ${toRoman(typeCurrentIndex[type])}`
      : baseLabel;
    
    return { song, displayLabel };
  });
};

const getTypeLabel = (type: string | undefined, labels: Record<string, string>) => {
  if (!type) return 'Sem tipo';
  
  const overrides: Record<string, string> = {
    canto_entrada: 'Entrada',
    entrada: 'Entrada',
    ato_penitencial: 'Ato Penitencial',
    perdao: 'Ato Penitencial',
    gloria: 'Glória',
    salmo: 'Salmo',
    aclamacao: 'Aclamação',
    oferendas: 'Ofertório',
    ofertorio: 'Ofertório',
    cordeiro: 'Cordeiro',
    santo: 'Santo',
    final: 'Final',
    comunhao: 'Comunhão',
    acao_gracas: 'Ação de Graças',
  };

  if (overrides[type]) return overrides[type];
  if (labels[type]) return labels[type];
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const SortableItem = ({
  song,
  displayLabel,
  index,
}: {
  song: EventSong;
  displayLabel: string;
  index: number;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: song.event_song_id,
  });

  const style = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card px-3 py-3 shadow-sm transition-shadow",
        isDragging && "shadow-lg ring-2 ring-primary/20"
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 touch-none items-center justify-center rounded-full bg-muted/60 text-muted-foreground hover:bg-muted/80 active:scale-95"
          aria-label="Arrastar para reordenar"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-primary/80">
            {displayLabel}
          </p>
          <p className="truncate text-sm font-medium text-foreground">{song.name}</p>
        </div>
      </div>
      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        #{index + 1}
      </span>
    </div>
  );
};

export const ReorderSongsSheet = ({
  open,
  onOpenChange,
  eventId,
  songs: initialSongs,
  typeLabels,
  onReorderComplete,
}: ReorderSongsSheetProps) => {
  const [songs, setSongs] = useState<EventSong[]>(initialSongs);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setSongs(initialSongs);
    setHasChanges(false);
  }, [initialSongs, open]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSongs(prev => {
      const oldIndex = prev.findIndex(s => s.event_song_id === active.id);
      const newIndex = prev.findIndex(s => s.event_song_id === over.id);

      if (oldIndex === -1 || newIndex === -1) return prev;

      setHasChanges(true);
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = songs.map((song, index) =>
        supabase
          .from('event_songs')
          .update({ order_index: index })
          .eq('id', song.event_song_id)
      );

      const results = await Promise.all(updates);
      const firstError = results.find(r => r.error)?.error;

      if (firstError) throw firstError;

      toast.success('Ordem das músicas atualizada');
      setHasChanges(false);
      onReorderComplete();
      onOpenChange(false);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar ordenação das músicas');
    } finally {
      setIsSaving(false);
    }
  };

  const songsWithLabels = getSongsWithRomanLabels(songs, typeLabels);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Reordenar Músicas</SheetTitle>
          <SheetDescription>
            Arraste as músicas para alterar a ordem. Tipos repetidos são numerados automaticamente.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-220px)] pr-1">
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={songs.map(s => s.event_song_id)}
              strategy={verticalListSortingStrategy}
            >
              {songsWithLabels.map(({ song, displayLabel }, index) => (
                <SortableItem
                  key={song.event_song_id}
                  song={song}
                  displayLabel={displayLabel}
                  index={index}
                />
              ))}
            </SortableContext>
          </DndContext>

          {songs.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma música no evento
            </p>
          )}
        </div>

        <div className="mt-6 flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Ordem'
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
