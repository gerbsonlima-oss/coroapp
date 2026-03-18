import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, X, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { z } from 'zod';
import { toast } from 'sonner';

const songSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(255, 'Nome muito longo'),
});

interface Song {
  id: string;
  name: string;
  type: string;
}

interface SongType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  order_index: number;
}

interface EventSongType {
  type: string;
  label: string;
  song?: Song;
  songTypeId?: string; // Reference to song_types table
}

interface EventSongTypeManagerProps {
  eventSongTypes: EventSongType[];
  availableSongs: Song[];
  onSongSelect: (type: string, song: Song) => void;
  onSongRemove: (type: string) => void;
  onSongCreate: (type: string, name: string) => Promise<void>;
  onSongTypesChange: (types: EventSongType[]) => void;
  disabled?: boolean;
}

export const EventSongTypeManager = ({
  eventSongTypes,
  availableSongs,
  onSongSelect,
  onSongRemove,
  onSongCreate,
  onSongTypesChange,
  disabled = false,
}: EventSongTypeManagerProps) => {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newSongName, setNewSongName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<EventSongType | null>(null);
  const [typeLabelInput, setTypeLabelInput] = useState('');
  const [globalSongTypes, setGlobalSongTypes] = useState<SongType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  // Fetch global song types from database
  useEffect(() => {
    fetchGlobalSongTypes();
  }, []);

  const fetchGlobalSongTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('song_types')
        .select('*')
        .order('order_index');

      if (error) throw error;
      setGlobalSongTypes(data || []);
    } catch (error) {
      console.error('Error fetching song types:', error);
      toast.error('Erro ao carregar tipos de música');
    } finally {
      setLoadingTypes(false);
    }
  };

  const openSearchDialog = (type: string) => {
    if (disabled) return;
    setSelectedType(type);
    setSearchQuery('');
  };

  const closeSearchDialog = () => {
    setSelectedType(null);
    setSearchQuery('');
  };

  const openCreateDialog = (type: string) => {
    if (disabled) return;
    setSelectedType(type);
    setShowCreateDialog(true);
    setNewSongName('');
  };

  const closeCreateDialog = () => {
    setSelectedType(null);
    setShowCreateDialog(false);
    setNewSongName('');
  };

  const handleSongSelect = (song: Song) => {
    if (selectedType) {
      onSongSelect(selectedType, song);
      closeSearchDialog();
    }
  };

  const handleCreateSong = async () => {
    if (!selectedType) return;

    try {
      songSchema.parse({ name: newSongName });
      setIsCreating(true);
      await onSongCreate(selectedType, newSongName);
      closeCreateDialog();
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const normalizeLabelToTypeId = (label: string) => {
    const base = label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    return base || `tipo_${Date.now()}`;
  };

  const openNewTypeDialog = () => {
    if (disabled || loadingTypes) return;
    setEditingType(null);
    setTypeLabelInput('');
    setIsTypeDialogOpen(true);
  };

  const openEditTypeDialog = (type: EventSongType) => {
    if (disabled) return;
    setEditingType(type);
    setTypeLabelInput(type.label);
    setIsTypeDialogOpen(true);
  };

  const closeTypeDialog = () => {
    setIsTypeDialogOpen(false);
    setEditingType(null);
    setTypeLabelInput('');
  };

  const handleSaveType = () => {
    const label = typeLabelInput.trim();
    if (!label) {
      toast.error('Nome do tipo é obrigatório');
      return;
    }

    const existingLabels = eventSongTypes.map((t) => t.label.toLowerCase());
    if (
      (!editingType || editingType.label.toLowerCase() !== label.toLowerCase()) &&
      existingLabels.includes(label.toLowerCase())
    ) {
      toast.error('Já existe um tipo com esse nome');
      return;
    }

    if (editingType) {
      const updated = eventSongTypes.map((t) =>
        t.type === editingType.type ? { ...t, label } : t
      );
      onSongTypesChange(updated);
    } else {
      let typeId = normalizeLabelToTypeId(label);
      const existingIds = new Set(eventSongTypes.map((t) => t.type));
      let suffix = 1;
      while (existingIds.has(typeId)) {
        typeId = `${typeId}_${suffix++}`;
      }

      const updated = [
        ...eventSongTypes,
        {
          type: typeId,
          label,
        },
      ];
      onSongTypesChange(updated);
    }

    closeTypeDialog();
  };

  const handleDeleteType = (typeId: string) => {
    if (disabled) return;
    const updated = eventSongTypes.filter((t) => t.type !== typeId);
    onSongTypesChange(updated);
  };
  const filteredSongs = availableSongs.filter((song) =>
    song.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loadingTypes) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Músicas da Missa</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openNewTypeDialog}
          disabled={disabled}
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar tipo
        </Button>
      </div>
      <div className="space-y-3">
        {eventSongTypes.map((item) => (
          <Card key={item.type} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{item.label}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="px-0"
                    onClick={() => openEditTypeDialog(item)}
                    disabled={disabled}
                  >
                    <Edit2 className="mr-1 h-3 w-3" />
                    Editar tipo
                  </Button>
                  <span className="text-border">•</span>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="px-0 text-destructive"
                    onClick={() => handleDeleteType(item.type)}
                    disabled={disabled}
                  >
                    <Trash2 className="mr-1 h-3 w-3" />
                    Remover
                  </Button>
                </div>
                {item.song && (
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {item.song.name}
                    </Badge>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {item.song ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onSongRemove(item.type)}
                    disabled={disabled}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openSearchDialog(item.type)}
                      disabled={disabled}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => openCreateDialog(item.type)}
                      disabled={disabled}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Dialog de busca de música */}
      <Dialog open={!!selectedType && !showCreateDialog} onOpenChange={closeSearchDialog}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buscar Música</DialogTitle>
            <DialogDescription>
              Selecione uma música existente para{' '}
              {eventSongTypes.find((t) => t.type === selectedType)?.label}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar música..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredSongs.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">
                  Nenhuma música encontrada
                </p>
              ) : (
                filteredSongs.map((song) => (
                  <Card
                    key={song.id}
                    className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSongSelect(song)}
                  >
                    <p className="font-medium">{song.name}</p>
                  </Card>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de criar música */}
      <Dialog open={showCreateDialog} onOpenChange={() => closeCreateDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Nova Música</DialogTitle>
            <DialogDescription>
              Criar uma nova música para{' '}
              {eventSongTypes.find((t) => t.type === selectedType)?.label}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-song-name">Nome da Música *</Label>
              <Input
                id="new-song-name"
                placeholder="Nome da música"
                value={newSongName}
                onChange={(e) => setNewSongName(e.target.value)}
                disabled={isCreating}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closeCreateDialog}
                disabled={isCreating}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleCreateSong}
                disabled={isCreating}
                className="gradient-primary shadow-glow"
              >
                {isCreating ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                ) : (
                  'Criar Música'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de tipo de música */}
      <Dialog open={isTypeDialogOpen} onOpenChange={closeTypeDialog}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingType ? 'Editar tipo de música' : 'Adicionar tipo de música'}
            </DialogTitle>
            <DialogDescription>
              {editingType 
                ? 'Edite o nome do tipo de música para este evento.'
                : 'Selecione um tipo existente ou crie um novo tipo personalizado.'}
            </DialogDescription>
          </DialogHeader>

          {editingType ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type-label">Nome do tipo *</Label>
                <Input
                  id="type-label"
                  placeholder="Ex.: Entrada"
                  value={typeLabelInput}
                  onChange={(e) => setTypeLabelInput(e.target.value)}
                  disabled={disabled}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeTypeDialog}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveType}
                  className="gradient-primary shadow-glow"
                >
                  Salvar alterações
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipos de música disponíveis</Label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {globalSongTypes.map((type) => {
                    const alreadyAdded = eventSongTypes.some(
                      (et) => et.songTypeId === type.id
                    );
                    return (
                      <Card
                        key={type.id}
                        className={cn(
                          'p-3 cursor-pointer hover:bg-muted/50 transition-colors',
                          alreadyAdded && 'opacity-50 cursor-not-allowed'
                        )}
                        onClick={() => {
                          if (alreadyAdded) return;
                          const updated = [
                            ...eventSongTypes,
                            {
                              type: type.slug,
                              label: type.name,
                              songTypeId: type.id,
                            },
                          ];
                          onSongTypesChange(updated);
                          closeTypeDialog();
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{type.name}</p>
                            {type.description && (
                              <p className="text-xs text-muted-foreground">
                                {type.description}
                              </p>
                            )}
                          </div>
                          {alreadyAdded && (
                            <Badge variant="secondary" className="text-xs">
                              Adicionado
                            </Badge>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="custom-type-label">Ou criar tipo personalizado</Label>
                <Input
                  id="custom-type-label"
                  placeholder="Ex.: Canto Especial"
                  value={typeLabelInput}
                  onChange={(e) => setTypeLabelInput(e.target.value)}
                  disabled={disabled}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeTypeDialog}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveType}
                  className="gradient-primary shadow-glow"
                  disabled={!typeLabelInput.trim()}
                >
                  Criar tipo personalizado
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
