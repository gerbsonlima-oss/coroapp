import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AudioPlayer } from '@/components/AudioPlayer';
import { AudioRecorder } from '@/components/AudioRecorder';
import { uploadFileToBucket } from '@/utils/storageUpload';
import { convertPdfToImages, createCombinedImage } from '@/utils/pdfToImage';
import { ArrowLeft, FileText, Upload, Trash2, Headphones, Plus, MoreVertical, Search, GripVertical } from 'lucide-react';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { z } from 'zod';

interface EventSummary {
  id: string;
  name: string;
  date: string;
  location: string | null;
}

interface SongAudio {
  id: string;
  song_id: string;
  naipe: string;
  audio_url: string;
  name: string;
}

interface QuickSong {
  eventSongId: string;
  songId: string;
  name: string;
  type: string | null;
  sheet_music_url: string | null;
  sheet_music_pdf_url: string | null;
  audios: SongAudio[];
}

interface SongOption {
  id: string;
  name: string;
  type: string;
}

const NAIPES = [
  { key: 'soprano', label: 'Soprano' },
  { key: 'contralto', label: 'Contralto' },
  { key: 'tenor', label: 'Tenor' },
  { key: 'baixo', label: 'Baixo' },
  { key: 'original', label: 'Música Original' },
] as const;

type NaipeKey = (typeof NAIPES)[number]['key'];


const typeColors: Record<string, string> = {
  canto_entrada: 'bg-muted text-muted-foreground border-border',
  ato_penitencial: 'bg-muted text-muted-foreground border-border',
  gloria: 'bg-muted text-muted-foreground border-border',
  salmo: 'bg-muted text-muted-foreground border-border',
  aclamacao: 'bg-muted text-muted-foreground border-border',
  oferendas: 'bg-muted text-muted-foreground border-border',
  santo: 'bg-muted text-muted-foreground border-border',
  cordeiro: 'bg-muted text-muted-foreground border-border',
  comunhao: 'bg-muted text-muted-foreground border-border',
  acao_gracas: 'bg-muted text-muted-foreground border-border',
  final: 'bg-muted text-muted-foreground border-border',
  entrada: 'bg-muted text-muted-foreground border-border',
  perdao: 'bg-muted text-muted-foreground border-border',
  ofertorio: 'bg-muted text-muted-foreground border-border',
  outro: 'bg-muted text-muted-foreground border-border',
};

const songSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(255, 'Nome muito longo'),
  type: z.string().min(1, 'Tipo é obrigatório'),
});

const getTypeLabel = (type: string | null | undefined, labels: Record<string, string>) => {
  if (!type) return 'Sem tipo';
  if (labels[type]) return labels[type];
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};


const sanitizeFileName = (fileName: string): string => {
  const lastDotIndex = fileName.lastIndexOf('.');
  const name = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
  const extension = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';

  const sanitized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  return sanitized + extension;
};

const ReorderSongItem = ({
  song,
  index,
  typeLabels,
}: {
  song: QuickSong;
  index: number;
  typeLabels: Record<string, string>;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: song.eventSongId,
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
      className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/80 px-3 py-2 text-sm shadow-sm"
    >
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/60 text-muted-foreground hover:bg-muted/80 active:scale-95"
          aria-label="Arrastar para reordenar"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase text-muted-foreground">
            {getTypeLabel(song.type, typeLabels)}
          </p>
          <p className="truncate text-sm font-medium">{song.name}</p>
        </div>
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">#{index + 1}</span>
    </div>
  );
};

const EventQuickEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventSummary | null>(null);
  const [songs, setSongs] = useState<QuickSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingSongId, setProcessingSongId] = useState<string | null>(null);
  const [processingAudioId, setProcessingAudioId] = useState<string | null>(null);
  const [activeAudio, setActiveAudio] = useState<{ eventSongId: string; naipe: NaipeKey } | null>(null);
  const [activeSheetSongEventId, setActiveSheetSongEventId] = useState<string | null>(null);
  const [availableSongs, setAvailableSongs] = useState<SongOption[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newSongType, setNewSongType] = useState<string>('');
  const [newSongId, setNewSongId] = useState<string>('');
  const [addingSong, setAddingSong] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSong, setSelectedSong] = useState<string | null>(null);
  const [newSongName, setNewSongName] = useState('');
  const [isCreatingSong, setIsCreatingSong] = useState(false);
  const [editingEventSongId, setEditingEventSongId] = useState<string | null>(null);
  const [typeLabels, setTypeLabels] = useState<Record<string, string>>({});
  const [isReordering, setIsReordering] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isExportingGrid, setIsExportingGrid] = useState(false);
  const [songNameFilter, setSongNameFilter] = useState('');


  const filteredAvailableSongs = availableSongs.filter((song) =>
    song.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSongs = songs.filter((song) =>
    song.name.toLowerCase().includes(songNameFilter.toLowerCase())
  );

  useEffect(() => {
    fetchSongTypes();
  }, []);

  const fetchSongTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('song_types')
        .select('*');

      if (error) throw error;

      const labels: Record<string, string> = {};
      (data || []).forEach((type) => {
        labels[type.slug] = type.name;
      });
      setTypeLabels(labels);
    } catch (error) {
      console.error('Error fetching song types:', error);
    }
  };

  useEffect(() => {
    if (id) {
      fetchData(id);
    }
  }, [id]);

  useEffect(() => {
    if (event) {
      document.title = `Edição rápida • ${event.name}`;
    } else {
      document.title = 'Edição rápida de músicas do evento';
    }
  }, [event]);


  const fetchData = async (eventId: string) => {
    setLoading(true)
    try {
      const [eventResult, eventSongsResult, songsResult] = await Promise.all([
        supabase.from('events').select('id, name, date, location').eq('id', eventId).single(),
        supabase
          .from('event_songs')
          .select(
            `id, type, song_id, order_index, songs ( id, name, type, sheet_music_url, sheet_music_pdf_url )`
          )
          .eq('event_id', eventId)
          .order('order_index'),
        supabase.from('songs').select('id, name, type').order('name'),
      ])

      if (eventResult.error) throw eventResult.error
      if (eventSongsResult.error) throw eventSongsResult.error
      if (songsResult.error) throw songsResult.error

      setEvent({
        id: eventResult.data.id,
        name: eventResult.data.name,
        date: eventResult.data.date,
        location: eventResult.data.location,
      })
      setAvailableSongs(songsResult.data || [])

      const eventSongs = eventSongsResult.data || []
      const songIds = eventSongs.map((es: any) => es.songs.id)
      let audiosBySong: Record<string, SongAudio[]> = {}
      if (songIds.length > 0) {
        const { data: audiosData, error: audiosError } = await supabase
          .from('song_audios')
          .select('*')
          .in('song_id', songIds)

        if (audiosError) throw audiosError

        ;(audiosData || []).forEach((audio: any) => {
          if (!audiosBySong[audio.song_id]) {
            audiosBySong[audio.song_id] = []
          }
          audiosBySong[audio.song_id].push(audio)
        })
      }

      const quickSongs: QuickSong[] = eventSongs.map((es: any) => ({
        eventSongId: es.id,
        songId: es.songs.id,
        name: es.songs.name,
        type: es.type ?? es.songs.type,
        sheet_music_url: es.songs.sheet_music_url,
        sheet_music_pdf_url: es.songs.sheet_music_pdf_url,
        audios: audiosBySong[es.songs.id] || [],
      }))

      setSongs(quickSongs)
    } catch (error) {
      console.error(error)
      toast.error('Erro ao carregar músicas do evento')
    } finally {
      setLoading(false)
    }
  }

  const persistOrder = async (orderedSongs: QuickSong[]) => {
    if (!id) return
    setIsSavingOrder(true)
    try {
      const updates = orderedSongs.map((song, index) =>
        supabase
          .from('event_songs')
          .update({ order_index: index })
          .eq('id', song.eventSongId)
      )

      const results = await Promise.all(updates)
      const firstError = results.find((r) => r.error)?.error

      if (firstError) throw firstError

      toast.success('Ordem das músicas atualizada')
    } catch (error) {
      console.error(error)
      toast.error('Erro ao salvar ordenação das músicas')
      // Recarrega dados do backend para manter consistência
      if (id) {
        fetchData(id)
      }
    } finally {
      setIsSavingOrder(false)
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setSongs((prev) => {
      const oldIndex = prev.findIndex((s) => s.eventSongId === active.id)
      const newIndex = prev.findIndex((s) => s.eventSongId === over.id)

      if (oldIndex === -1 || newIndex === -1) return prev

      const newOrder = arrayMove(prev, oldIndex, newIndex)
      void persistOrder(newOrder)
      return newOrder
    })
  }

  const handleExportGridPdf = async () => {
    if (!event) return;

    try {
      setIsExportingGrid(true);

      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Grade de músicas do evento', pageWidth / 2, margin + 4, {
        align: 'center',
      } as any);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      let headerY = margin + 12;
      doc.text(`Evento: ${event.name}`, margin, headerY);
      headerY += 5;
      if (event.date) {
        doc.text(`Data: ${event.date}`, margin, headerY);
        headerY += 5;
      }
      if (event.location) {
        doc.text(`Local: ${event.location}`, margin, headerY);
        headerY += 5;
      }

      const columns = [
        { key: 'type' as const, label: 'Tipo', width: 30 },
        { key: 'name' as const, label: 'Música', width: 60 },
        ...NAIPES.map(({ key, label }) => ({
          key: key as NaipeKey,
          label,
          width: 15,
        })),
        { key: 'sheet' as const, label: 'Partitura', width: 20 },
      ];

      const tableTop = headerY + 6;
      let y = tableTop;
      const rowHeight = 6;

      const drawHeaderRow = () => {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        let x = margin;
        columns.forEach((col) => {
          const centerX = x + col.width / 2;
          doc.text(String(col.label), centerX, y, { align: 'center' } as any);
          x += col.width;
        });
        y += rowHeight;
        doc.setFont('helvetica', 'normal');
      };

      drawHeaderRow();
      doc.setFontSize(8);

      songs.forEach((song) => {
        if (y > pageHeight - margin) {
          doc.addPage();
          y = margin + 10;
          drawHeaderRow();
        }

        let x = margin;
        const hasSheet = !!(song.sheet_music_url || song.sheet_music_pdf_url);
        const naipesWithAudio = new Set(song.audios.map((a) => a.naipe));
        const selectedSong = availableSongs.find((s) => s.id === song.songId);

        const typeLabel = getTypeLabel(song.type, typeLabels);
        doc.text(typeLabel, x + 1, y);
        x += columns[0].width;

        const nameText = selectedSong?.name ?? song.name;
        doc.text(nameText, x + 1, y);
        x += columns[1].width;

        NAIPES.forEach((naipe, index) => {
          const col = columns[2 + index];
          const centerX = x + col.width / 2;
          const hasNaipeAudio = naipesWithAudio.has(naipe.key);
          doc.text(hasNaipeAudio ? '✓' : '—', centerX, y, { align: 'center' } as any);
          x += col.width;
        });

        const sheetCol = columns[columns.length - 1];
        const sheetCenterX = x + sheetCol.width / 2;
        doc.text(hasSheet ? '✓' : '—', sheetCenterX, y, { align: 'center' } as any);

        y += rowHeight;
      });

      const safeName = event.name.replace(/[^a-z0-9]/gi, '_') || 'evento';
      const fileName = `Grade_${safeName}.pdf`;
      doc.save(fileName);

      toast.success('PDF da grade exportado com sucesso');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao exportar PDF da grade');
    } finally {
      setIsExportingGrid(false);
    }
  };

  const handleAttachSheet = async (song: QuickSong, file: File) => {
    setProcessingSongId(song.songId);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) throw new Error('Usuário não autenticado');

      let sheetImageFile: File | null = null;
      let sheetPdfFile: File | null = null;

      if (file.type === 'application/pdf') {
        toast.info('Convertendo PDF para imagem...');
        const pages = await convertPdfToImages(file, () => {});
        const combinedBlob = await createCombinedImage(pages);
        sheetImageFile = new File(
          [combinedBlob],
          file.name.replace('.pdf', '.jpg'),
          { type: 'image/jpeg' }
        );
        sheetPdfFile = file;
        toast.success(
          `PDF convertido com sucesso (${pages.length} página${pages.length > 1 ? 's' : ''})`
        );
      } else {
        sheetImageFile = file;
      }

      let sheet_music_url: string | null = song.sheet_music_url;
      let sheet_music_pdf_url: string | null = song.sheet_music_pdf_url;

      if (sheetImageFile) {
        const sanitizedName = sanitizeFileName(sheetImageFile.name);
        const path = `${user.id}/${Date.now()}_${sanitizedName}`;
        sheet_music_url = await uploadFileToBucket(sheetImageFile, 'sheet-music', path);
      }

      if (sheetPdfFile) {
        const sanitizedPdfName = sanitizeFileName(sheetPdfFile.name);
        const pdfPath = `${user.id}/${Date.now()}_original_${sanitizedPdfName}`;
        sheet_music_pdf_url = await uploadFileToBucket(sheetPdfFile, 'sheet-music', pdfPath);
      }

      const { error } = await supabase
        .from('songs')
        .update({ sheet_music_url, sheet_music_pdf_url })
        .eq('id', song.songId);

      if (error) throw error;

      setSongs((prev) =>
        prev.map((s) =>
          s.songId === song.songId
            ? { ...s, sheet_music_url, sheet_music_pdf_url }
            : s
        )
      );

      toast.success('Partitura anexada com sucesso');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao anexar partitura');
    } finally {
      setProcessingSongId(null);
    }
  };

  const handleRemoveSheet = async (song: QuickSong) => {
    setProcessingSongId(song.songId);
    try {
      const { error } = await supabase
        .from('songs')
        .update({ sheet_music_url: null, sheet_music_pdf_url: null })
        .eq('id', song.songId);

      if (error) throw error;

      setSongs((prev) =>
        prev.map((s) =>
          s.songId === song.songId
            ? { ...s, sheet_music_url: null, sheet_music_pdf_url: null }
            : s
        )
      );

      toast.success('Partitura removida');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao remover partitura');
    } finally {
      setProcessingSongId(null);
    }
  };

  const handleRemoveSongFromEvent = async (song: QuickSong) => {
    setProcessingSongId(song.songId);
    try {
      const { error } = await supabase
        .from('event_songs')
        .delete()
        .eq('id', song.eventSongId);

      if (error) throw error;

      setSongs((prev) => prev.filter((s) => s.eventSongId !== song.eventSongId));
      toast.success('Canto removido do evento');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao remover canto');
    } finally {
      setProcessingSongId(null);
    }
  };

  const handleChangeSongType = async (song: QuickSong, newType: string | null) => {
    setProcessingSongId(song.songId);
    try {
      const { error } = await supabase
        .from('event_songs')
        .update({ type: newType })
        .eq('id', song.eventSongId);

      if (error) throw error;

      setSongs((prev) =>
        prev.map((s) =>
          s.eventSongId === song.eventSongId
            ? { ...s, type: newType }
            : s
        )
      );

      toast.success('Tipo de música atualizado');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar tipo de música');
    } finally {
      setProcessingSongId(null);
    }
  };

  const handleChangeSongInEvent = async (
    row: QuickSong,
    newSongId: string,
    songDataOverride?: {
      id: string;
      name: string;
      type: string;
      sheet_music_url: string | null;
      sheet_music_pdf_url: string | null;
    }
  ) => {
    setProcessingSongId(row.songId);
    try {
      let songRow = songDataOverride;

      if (!songRow) {
        const { data, error } = await supabase
          .from('songs')
          .select('id, name, type, sheet_music_url, sheet_music_pdf_url')
          .eq('id', newSongId)
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('Música não encontrada');
        songRow = data as typeof songDataOverride;
      }

      const { error: updateError } = await supabase
        .from('event_songs')
        .update({ song_id: newSongId })
        .eq('id', row.eventSongId);

      if (updateError) throw updateError;

      let audios: SongAudio[] = [];
      const { data: audiosData, error: audiosError } = await supabase
        .from('song_audios')
        .select('*')
        .eq('song_id', newSongId);

      if (!audiosError && audiosData) {
        audios = audiosData as SongAudio[];
      }

      setSongs((prev) =>
        prev.map((s) =>
          s.eventSongId === row.eventSongId
            ? {
                ...s,
                songId: songRow!.id,
                name: songRow!.name,
                // Mantém o tipo do evento (posição na missa)
                sheet_music_url: songRow!.sheet_music_url,
                sheet_music_pdf_url: songRow!.sheet_music_pdf_url,
                audios,
              }
            : s
        )
      );

      toast.success('Música atualizada no evento');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar música do evento');
    } finally {
      setProcessingSongId(null);
    }
  };

  const handleCreateSongForRow = async (row: QuickSong) => {
    const name = window.prompt('Nome da nova música:');
    const trimmed = name?.trim();

    if (!trimmed) return;
    if (trimmed.length < 3) {
      toast.error('O nome da música deve ter pelo menos 3 caracteres');
      return;
    }
    if (trimmed.length > 100) {
      toast.error('O nome da música deve ter no máximo 100 caracteres');
      return;
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) throw new Error('Usuário não autenticado');

      const { data: songData, error: songError } = await supabase
        .from('songs')
        .insert({
          user_id: user.id,
          name: trimmed,
          type: row.type || 'outro',
          notes: '',
          sheet_music_url: null,
        })
        .select('id, name, type, sheet_music_url, sheet_music_pdf_url')
        .single();

      if (songError) throw songError;

      setAvailableSongs((prev) => [
        ...prev,
        { id: songData.id, name: songData.name, type: songData.type },
      ]);

      await handleChangeSongInEvent(row, songData.id, songData);
      toast.success('Música criada e vinculada ao evento');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao criar música');
    }
  };

  const handleAddSongToEvent = async () => {
    if (!id || !newSongId || !newSongType) return;

    setAddingSong(true);
    try {
      const { data: insertedEventSong, error: insertError } = await supabase
        .from('event_songs')
        .insert({
          event_id: id,
          song_id: newSongId,
          type: newSongType,
          order_index: songs.length,
        })
        .select(
          `id, type, song_id, songs ( id, name, type, sheet_music_url, sheet_music_pdf_url )`
        )
        .single();

      if (insertError) throw insertError;

      let audios: SongAudio[] = [];
      const { data: audiosData, error: audiosError } = await supabase
        .from('song_audios')
        .select('*')
        .eq('song_id', newSongId);

      if (audiosError) {
        console.error(audiosError);
      } else if (audiosData) {
        audios = audiosData as SongAudio[];
      }

      const newQuickSong: QuickSong = {
        eventSongId: (insertedEventSong as any).id,
        songId: (insertedEventSong as any).songs.id,
        name: (insertedEventSong as any).songs.name,
        type:
          (insertedEventSong as any).type ?? (insertedEventSong as any).songs.type,
        sheet_music_url: (insertedEventSong as any).songs.sheet_music_url,
        sheet_music_pdf_url: (insertedEventSong as any).songs.sheet_music_pdf_url,
        audios,
      };

      setSongs((prev) => [...prev, newQuickSong]);
      toast.success('Canto adicionado ao evento');
      setIsAddDialogOpen(false);
      setNewSongId('');
      setNewSongType('');
      setSelectedSong(null);
      setSearchQuery('');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao adicionar canto');
    } finally {
      setAddingSong(false);
    }
  };

  const handleCreateAndAddSongToEvent = async () => {
    try {
      const validatedData = songSchema.parse({
        name: newSongName,
        type: newSongType,
      });

      setIsCreatingSong(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: songData, error: songError } = await supabase
        .from('songs')
        .insert([
          {
            user_id: user.id,
            name: validatedData.name,
            type: validatedData.type,
            notes: '',
            sheet_music_url: null,
          },
        ])
        .select('id, name, type, sheet_music_url, sheet_music_pdf_url')
        .single();

      if (songError) throw songError;

      const { data: insertedEventSong, error: eventSongError } = await supabase
        .from('event_songs')
        .insert([
          {
            event_id: id,
            song_id: songData.id,
            type: validatedData.type,
            order_index: songs.length,
          },
        ])
        .select(
          'id, type, song_id'
        )
        .single();

      if (eventSongError) throw eventSongError;

      let audios: SongAudio[] = [];
      const { data: audiosData, error: audiosError } = await supabase
        .from('song_audios')
        .select('*')
        .eq('song_id', songData.id);

      if (!audiosError && audiosData) {
        audios = audiosData as SongAudio[];
      }

      const newQuickSong: QuickSong = {
        eventSongId: (insertedEventSong as any).id,
        songId: songData.id,
        name: songData.name,
        type: (insertedEventSong as any).type ?? songData.type,
        sheet_music_url: songData.sheet_music_url,
        sheet_music_pdf_url: songData.sheet_music_pdf_url,
        audios,
      };

      setSongs((prev) => [...prev, newQuickSong]);
      setAvailableSongs((prev) => [
        ...prev,
        { id: songData.id, name: songData.name, type: songData.type },
      ]);

      toast.success('Música criada e adicionada ao evento!');
      setIsAddDialogOpen(false);
      setNewSongName('');
      setNewSongType('');
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('Erro ao criar música');
      }
    } finally {
      setIsCreatingSong(false);
    }
  };

  const handleAttachAudio = async (song: QuickSong, naipe: NaipeKey, file: File) => {
    setProcessingAudioId(`${song.songId}-${naipe}`);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) throw new Error('Usuário não autenticado');

      const sanitizedName = sanitizeFileName(file.name);
      const path = `${user.id}/${naipe}_${Date.now()}_${sanitizedName}`;
      const audioUrl = await uploadFileToBucket(file, 'audio-files', path);

      const { data, error } = await supabase
        .from('song_audios')
        .insert({
          song_id: song.songId,
          naipe,
          audio_url: audioUrl,
          name: `${naipe.charAt(0).toUpperCase() + naipe.slice(1)} - ${event?.name || ''}`.trim(),
        })
        .select()
        .single();

      if (error) throw error;

      setSongs((prev) =>
        prev.map((s) =>
          s.songId === song.songId ? { ...s, audios: [...s.audios, data as SongAudio] } : s
        )
      );

      toast.success('Áudio anexado com sucesso');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao anexar áudio');
    } finally {
      setProcessingAudioId(null);
    }
  };

  const handleDeleteAudio = async (song: QuickSong, audio: SongAudio) => {
    setProcessingAudioId(audio.id);
    try {
      const { error } = await supabase
        .from('song_audios')
        .delete()
        .eq('id', audio.id);

      if (error) throw error;

      setSongs((prev) =>
        prev.map((s) =>
          s.songId === song.songId
            ? { ...s, audios: s.audios.filter((a) => a.id !== audio.id) }
            : s
        )
      );

      toast.success('Áudio excluído');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir áudio');
    } finally {
      setProcessingAudioId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Evento não encontrado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto flex items-center gap-4 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/events/${id}`)}
            className="shrink-0 hover-scale"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex flex-col">
            <h1 className="truncate text-lg font-bold">Edição rápida de músicas</h1>
            <p className="truncate text-xs text-muted-foreground">{event.name}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto space-y-4 p-4 animate-fade-in">
        {songs.length === 0 ? (
          <Card className="space-y-4 p-6 text-center shadow-sm animate-scale-in">
            <p className="text-sm text-muted-foreground">
              Nenhuma música cadastrada neste evento ainda.
            </p>
            <Button
              size="sm"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-full px-4 hover-scale"
              onClick={() => setIsAddDialogOpen(true)}
            >
              <Plus className="h-4 w-4" />
              <span>Adicionar canto</span>
            </Button>
          </Card>
        ) : (
          <section className="space-y-4 animate-fade-in">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {songs.length} canto{songs.length === 1 ? '' : 's'} neste evento
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <Button
                  size="default"
                  variant="outline"
                  className="h-10 w-full rounded-full sm:w-auto hover-scale"
                  onClick={handleExportGridPdf}
                  disabled={isExportingGrid}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  {isExportingGrid ? 'Gerando PDF...' : 'Exportar grade em PDF'}
                </Button>
                <Button
                  size="default"
                  className="h-10 w-full rounded-full sm:w-auto hover-scale"
                  onClick={() => setIsAddDialogOpen(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar canto
                </Button>
              </div>
            </div>


            {songs.length > 0 && (
              <>
                {songs.length > 1 && (
                  <Card className="space-y-3 rounded-xl border border-dashed border-border/60 bg-muted/30 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Ordenar músicas</p>
                        <p className="text-xs text-muted-foreground">
                          Arraste para cima ou para baixo para definir a ordem do evento.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 rounded-full px-3 text-xs hover-scale"
                        onClick={() => setIsReordering((prev) => !prev)}
                      >
                        {isReordering ? 'Concluir' : 'Reordenar'}
                      </Button>
                    </div>
                    {isReordering && (
                      <div className="space-y-2">
                        {isSavingOrder && (
                          <p className="text-[11px] text-muted-foreground">Salvando nova ordem...</p>
                        )}
                        <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                          <SortableContext
                            items={songs.map((s) => s.eventSongId)}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="mt-1 space-y-2">
                              {songs.map((song, index) => (
                                <ReorderSongItem
                                  key={song.eventSongId}
                                  song={song}
                                  index={index}
                                  typeLabels={typeLabels}
                                />
                              ))}
                            </div>
                          </SortableContext>
                        </DndContext>
                      </div>
                    )}
                  </Card>
                )}

                <Card className="mt-4 overflow-x-auto rounded-xl border border-border/60 bg-card/80 shadow-sm sm:shadow-md animate-fade-in">
                  {/* Filtro de busca por nome */}
                  <div className="border-b border-border/40 px-3 py-3 sm:px-4">
                    <div className="relative max-w-xs">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar música pelo nome..."
                        value={songNameFilter}
                        onChange={(e) => setSongNameFilter(e.target.value)}
                        className="h-9 pl-9 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    {/* Mobile: cards */}
                    <div className="space-y-3 p-3 md:hidden">
                      {filteredSongs.map((song) => {
                      const hasSheet = !!(song.sheet_music_url || song.sheet_music_pdf_url);
                      const selectedSong = availableSongs.find((s) => s.id === song.songId);

                      return (
                        <Card
                          key={`card-${song.eventSongId}`}
                          className="rounded-xl border border-border/60 bg-card/80 p-3 shadow-sm animate-fade-in"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                                {getTypeLabel(song.type, typeLabels)}
                              </p>
                              <p className="mt-1 line-clamp-2 text-sm font-medium">
                                {selectedSong?.name ?? 'Selecione a música'}
                              </p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 shrink-0 hover-scale"
                                  aria-label="Mais opções do canto"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="z-50 bg-popover border border-border/60 shadow-md"
                              >
                                <DropdownMenuItem
                                  onClick={() =>
                                    navigate(
                                      `/songs/${song.songId}/edit${id ? '?eventId=' + id : ''}`
                                    )
                                  }
                                >
                                  Editar música (biblioteca)
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setEditingEventSongId(song.eventSongId)}
                                >
                                  Ajustar neste evento
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => setActiveSheetSongEventId(song.eventSongId)}
                                >
                                  {hasSheet ? 'Ver partitura' : 'Anexar partitura'}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() =>
                                    setActiveAudio({
                                      eventSongId: song.eventSongId,
                                      naipe: 'original',
                                    })
                                  }
                                >
                                  Áudios (naipe original)
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => {
                                    if (processingSongId) return;
                                    handleRemoveSongFromEvent(song);
                                  }}
                                >
                                  Remover do evento
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <Button
                            type="button"
                            className="mt-3 h-10 w-full rounded-full text-sm hover-scale"
                            onClick={() => setEditingEventSongId(song.eventSongId)}
                          >
                            Ajustar música neste evento
                          </Button>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Desktop: tabela completa */}
                  <div className="hidden md:block">
                    <TooltipProvider delayDuration={200}>
                    <Table>
                      <TableHeader className="sticky top-0 z-10 bg-background">
                        <TableRow className="bg-muted/40">
                          <TableHead className="w-[180px] text-xs uppercase text-muted-foreground">
                            Tipo da música
                          </TableHead>
                          <TableHead className="text-xs uppercase text-muted-foreground">
                            Música
                          </TableHead>
                          {NAIPES.map(({ key, label }) => (
                            <TableHead
                              key={key}
                              className="w-[72px] text-center text-xs uppercase text-muted-foreground"
                            >
                              {label}
                            </TableHead>
                          ))}
                          <TableHead className="w-[110px] text-center text-xs uppercase text-muted-foreground">
                            Partitura
                          </TableHead>
                          <TableHead className="w-[100px] text-center text-xs uppercase text-muted-foreground">
                            Ações
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSongs.map((song) => {
                          const hasSheet = !!(song.sheet_music_url || song.sheet_music_pdf_url);
                          const naipesWithAudio = new Set(song.audios.map((a) => a.naipe));
                          const selectedSong = availableSongs.find((s) => s.id === song.songId);

                          return (
                            <TableRow
                              key={`row-${song.eventSongId}`}
                              className="border-b-2 border-border/60 text-sm hover:bg-muted/40 transition-colors"
                            >
                              <TableCell className="w-[180px] align-middle text-xs">
                                {getTypeLabel(song.type, typeLabels)}
                              </TableCell>
                              <TableCell className="align-middle text-sm">
                                <span className="whitespace-normal break-words">
                                  {selectedSong?.name ?? 'Selecione a música'}
                                </span>
                              </TableCell>
                              {NAIPES.map(({ key, label }) => {
                                const hasNaipeAudio = naipesWithAudio.has(key);
                                return (
                                  <TableCell
                                    key={`${song.eventSongId}-${key}`}
                                    className="w-[72px] align-middle text-center"
                                  >
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="outline"
                                          className={cn(
                                            'inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 transition-colors hover-scale',
                                            hasNaipeAudio
                                              ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                              : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'
                                          )}
                                          onClick={() =>
                                            setActiveAudio({ eventSongId: song.eventSongId, naipe: key })
                                          }
                                          aria-label={
                                            hasNaipeAudio
                                              ? `Gerenciar áudio de ${label}`
                                              : `Adicionar áudio para ${label}`
                                          }
                                        >
                                          {hasNaipeAudio ? (
                                            <Headphones className="h-4 w-4" />
                                          ) : (
                                            <Upload className="h-4 w-4" />
                                          )}
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{hasNaipeAudio ? `Gerenciar áudio: ${label}` : `Adicionar áudio: ${label}`}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TableCell>
                                );
                              })}
                              <TableCell className="align-middle text-center">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="outline"
                                      className={cn(
                                        'inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 transition-colors hover-scale',
                                        hasSheet
                                          ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                          : 'bg-muted/40 text-muted-foreground hover:bg-muted/60'
                                      )}
                                      onClick={() => setActiveSheetSongEventId(song.eventSongId)}
                                      aria-label={hasSheet ? 'Ver ou trocar partitura' : 'Anexar partitura'}
                                    >
                                      {hasSheet ? (
                                        <FileText className="h-4 w-4" />
                                      ) : (
                                        <Upload className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{hasSheet ? 'Ver ou trocar partitura' : 'Anexar partitura'}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TableCell>
                              <TableCell className="align-middle text-center">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-8 w-8 hover-scale"
                                      aria-label="Ações do canto"
                                    >
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent
                                    align="end"
                                    className="z-50 bg-popover border border-border/60 shadow-md"
                                  >
                                    <DropdownMenuItem
                                      onClick={() =>
                                        navigate(
                                          `/songs/${song.songId}/edit${id ? '?eventId=' + id : ''}`
                                        )
                                      }
                                    >
                                      Editar música
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => setEditingEventSongId(song.eventSongId)}
                                    >
                                      Ajustar no evento
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => {
                                        if (processingSongId) return;
                                        handleRemoveSongFromEvent(song);
                                      }}
                                    >
                                      Remover do evento
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                       </TableBody>
                     </Table>
                    </TooltipProvider>
                     </div>
                   </div>
                 </Card>
              </>
            )}

           </section>
        )}
      </main>

      {/* Modal de edição de tipo e música */}
      {editingEventSongId && (() => {
        const song = songs.find((s) => s.eventSongId === editingEventSongId);
        if (!song) return null;
        const selectedSong = availableSongs.find((s) => s.id === song.songId);

        return (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open) setEditingEventSongId(null);
            }}
          >
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Editar canto do evento</DialogTitle>
                <DialogDescription>
                  Ajuste o tipo litúrgico e selecione a música desejada.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-md border border-border/60 bg-muted/40 p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    {getTypeLabel(song.type, typeLabels)}
                  </p>
                  <p className="text-sm font-medium">
                    {selectedSong?.name ?? song.name}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Tipo da música
                  </p>
                  <Select
                    value={song.type ?? "__none"}
                    onValueChange={async (value) => {
                      if (value === "__custom") {
                        const label = window.prompt(
                          "Digite o nome do novo tipo de música:"
                        );
                        const trimmed = label?.trim();
                        if (!trimmed) return;

                        const slug = trimmed
                          .normalize("NFD")
                          .replace(/[\u0300-\u036f]/g, "")
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, "_")
                          .replace(/^_|_$/g, "");

                        await handleChangeSongType(song, slug);
                      } else if (value === "__none") {
                        await handleChangeSongType(song, null);
                      } else {
                        await handleChangeSongType(song, value);
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 w-full text-sm">
                      <SelectValue placeholder="Sem tipo" />
                    </SelectTrigger>
                    <SelectContent className="z-50">
                      <SelectItem value="__none">Sem tipo</SelectItem>
                      {Object.entries(typeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom">+ Novo tipo...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Música
                  </p>
                  <Select
                    value={song.songId}
                    onValueChange={async (value) => {
                      if (value === "__new") {
                        await handleCreateSongForRow(song);
                      } else {
                        await handleChangeSongInEvent(song, value);
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 w-full text-sm">
                      <SelectValue placeholder="Selecione a música" />
                    </SelectTrigger>
                    <SelectContent className="z-50 max-h-72">
                      {availableSongs.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                      <SelectItem value="__new">+ Nova música...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Modal de gestão de áudio por naipe */}
      {activeAudio && (() => {
        const song = songs.find((s) => s.eventSongId === activeAudio.eventSongId);
        if (!song) return null;
        const naipeInfo = NAIPES.find((n) => n.key === activeAudio.naipe);
        const naipeLabel = naipeInfo?.label ?? activeAudio.naipe;
        const naipeAudios = song.audios.filter((a) => a.naipe === activeAudio.naipe);
        const hasAudio = naipeAudios.length > 0;

        return (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open) setActiveAudio(null);
            }}
          >
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{getTypeLabel(song.type, typeLabels)} • {song.name}</DialogTitle>
                <DialogDescription>
                  Gerencie os áudios do naipe {naipeLabel}.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {!hasAudio && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum áudio cadastrado ainda para este naipe.
                  </p>
                )}

                {hasAudio && (
                  <div className="space-y-3">
                    {naipeAudios.map((audio) => (
                      <div key={audio.id} className="space-y-2 rounded-md border border-border/60 bg-card/50 p-3">
                        <AudioPlayer src={audio.audio_url} naipe={audio.name} />
                        <div className="flex justify-end">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteAudio(song, audio)}
                            disabled={processingAudioId === audio.id}
                            aria-label="Excluir áudio"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-2 flex items-center gap-3">
                  <label className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
                    <Upload className="h-4 w-4" />
                    <Input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleAttachAudio(song, activeAudio.naipe, file);
                          e.target.value = '';
                        }
                      }}
                      disabled={processingAudioId === `${song.songId}-${activeAudio.naipe}`}
                    />
                  </label>
                  <div className="flex-1">
                    <AudioRecorder
                      compact
                      naipeName={naipeLabel}
                      onRecordingComplete={(file) =>
                        handleAttachAudio(song, activeAudio.naipe, file)
                      }
                    />
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Modal de gestão de partitura */}
      {activeSheetSongEventId && (() => {
        const song = songs.find((s) => s.eventSongId === activeSheetSongEventId);
        if (!song) return null;
        const hasSheet = !!(song.sheet_music_url || song.sheet_music_pdf_url);

        return (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open) setActiveSheetSongEventId(null);
            }}
          >
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Partitura</DialogTitle>
                <DialogDescription>
                  Gerencie a partitura deste canto.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-md border border-border/60 bg-muted/40 p-3">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    {getTypeLabel(song.type, typeLabels)}
                  </p>
                  <p className="text-sm font-medium">{song.name}</p>
                </div>

                <div className="space-y-3 rounded-md border border-border/60 bg-card/50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        Partitura
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {hasSheet
                          ? 'Partitura já anexada para este canto.'
                          : 'Nenhuma partitura anexada ainda.'}
                      </p>
                    </div>
                    {hasSheet && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => {
                            const url = song.sheet_music_pdf_url || song.sheet_music_url;
                            if (url) window.open(url, '_blank');
                          }}
                          aria-label="Visualizar partitura"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveSheet(song)}
                          disabled={processingSongId === song.songId}
                          aria-label="Remover partitura"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {!hasSheet && (
                    <div className="flex flex-col items-end gap-1">
                      <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
                        <Upload className="mr-1 h-3 w-3" />
                        Anexar partitura
                        <Input
                          type="file"
                          accept=".pdf,image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              handleAttachSheet(song, file);
                              e.target.value = '';
                            }
                          }}
                          disabled={processingSongId === song.songId}
                        />
                      </label>
                      <p className="text-[10px] text-muted-foreground">
                        PDF recomendado para melhor qualidade.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      <AlertDialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) {
            setSelectedSong(null);
            setSearchQuery('');
            setNewSongName('');
            setNewSongType('');
          }
        }}
      >
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Adicionar Música</AlertDialogTitle>
            <AlertDialogDescription>
              Escolha uma música existente ou crie uma nova
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Tabs defaultValue="existing" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="existing">Música Existente</TabsTrigger>
              <TabsTrigger value="new">Nova Música</TabsTrigger>
            </TabsList>

            <TabsContent value="existing" className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar música..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <div className="max-h-[300px] space-y-2 overflow-y-auto">
                {filteredAvailableSongs.length === 0 ? (
                  <p className="py-8 text-center text-muted-foreground">
                    {searchQuery
                      ? 'Nenhuma música encontrada'
                      : 'Todas as músicas já foram adicionadas'}
                  </p>
                ) : (
                  filteredAvailableSongs.map((song) => (
                    <Card
                      key={song.id}
                      onClick={() => {
                        setSelectedSong(song.id);
                        setNewSongId(song.id);
                        setNewSongType(song.type || 'outro');
                      }}
                      className={`cursor-pointer p-3 transition-all ${
                        selectedSong === song.id
                          ? 'border-primary bg-primary/10'
                          : 'hover:bg-accent'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{song.name}</span>
                        <Badge className={typeColors[song.type] || typeColors.outro}>
                          {typeLabels[song.type] || song.type}
                        </Badge>
                      </div>
                    </Card>
                  ))
                )}
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    setSelectedSong(null);
                    setSearchQuery('');
                  }}
                >
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleAddSongToEvent}
                  disabled={!selectedSong}
                  className="gradient-primary"
                >
                  Adicionar
                </AlertDialogAction>
              </AlertDialogFooter>
            </TabsContent>

            <TabsContent value="new" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome da Música</label>
                  <Input
                    placeholder="Digite o nome da música"
                    value={newSongName}
                    onChange={(e) => setNewSongName(e.target.value)}
                    maxLength={255}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Tipo</label>
                  <Select value={newSongType} onValueChange={setNewSongType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(typeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => {
                    setNewSongName('');
                    setNewSongType('');
                  }}
                >
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleCreateAndAddSongToEvent}
                  disabled={!newSongName.trim() || !newSongType || isCreatingSong}
                  className="gradient-primary"
                >
                  {isCreatingSong ? 'Criando...' : 'Criar e Adicionar'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </TabsContent>
          </Tabs>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default EventQuickEdit;
