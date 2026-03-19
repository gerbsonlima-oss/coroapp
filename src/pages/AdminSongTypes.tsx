import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useTenant, useTenantPath } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { ArrowLeft, Plus, Edit2, Trash2, GripVertical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';

const songTypeSchema = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(100, 'Nome muito longo'),
  slug: z
    .string()
    .trim()
    .min(1, 'Identificador é obrigatório')
    .max(50, 'Identificador muito longo')
    .regex(/^[a-z0-9_]+$/, 'Use apenas letras minúsculas, números e underscore'),
  description: z.string().max(500, 'Descrição muito longa').optional(),
});

interface SongType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  order_index: number;
  created_at: string;
}

const SortableSongTypeItem = ({
  type,
  index,
  disabled,
  onEdit,
  onDelete,
}: {
  type: SongType;
  index: number;
  disabled: boolean;
  onEdit: (type: SongType) => void;
  onDelete: (type: SongType) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: type.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn('p-4 transition-shadow hover:shadow-md', isDragging && 'shadow-lg ring-2 ring-primary/20')}
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="flex items-center text-muted-foreground touch-none disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Arrastar para reordenar"
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>

        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="font-semibold">{type.name}</h3>
            <Badge variant="outline" className="text-xs">
              {type.slug}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              #{index + 1}
            </Badge>
          </div>
          {type.description && (
            <p className="text-sm text-muted-foreground">{type.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(type)}
            disabled={disabled}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(type)}
            disabled={disabled}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};

const AdminSongTypes = () => {
  const navigate = useNavigate();
  const { tenantId } = useTenant();
  const { buildPath } = useTenantPath();
  const { isAdmin, loading: adminLoading } = useIsAdmin();

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error('Você não tem permissão para acessar esta página');
      navigate(buildPath('/songs'));
    }
  }, [isAdmin, adminLoading, navigate, buildPath]);
  const [songTypes, setSongTypes] = useState<SongType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<SongType | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [typeToDelete, setTypeToDelete] = useState<SongType | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (tenantId) {
      fetchSongTypes();
    }
  }, [tenantId]);

  const fetchSongTypes = async () => {
    try {
      // ✅ Tipos de música agora são globais
      const { data, error } = await supabase
        .from('song_types')
        .select('*')
        .order('order_index');

      if (error) throw error;
      setSongTypes(data || []);
    } catch (error) {
      console.error('Error fetching song types:', error);
      toast.error('Erro ao carregar tipos de música');
    } finally {
      setLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingType(null);
    setFormData({ name: '', slug: '', description: '' });
    setErrors({});
    setIsDialogOpen(true);
  };

  const openEditDialog = (type: SongType) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      slug: type.slug,
      description: type.description || '',
    });
    setErrors({});
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingType(null);
    setFormData({ name: '', slug: '', description: '' });
    setErrors({});
  };

  const handleSave = async () => {
    setErrors({});
    setSaving(true);

    try {
      const validatedData = songTypeSchema.parse(formData);

      if (editingType) {
        // Update existing type
        const { error } = await supabase
          .from('song_types')
          .update({
            name: validatedData.name,
            slug: validatedData.slug,
            description: validatedData.description || null,
          })
          .eq('id', editingType.id);

        if (error) throw error;
        toast.success('Tipo de música atualizado com sucesso!');
      } else {
        // Create new type
        const maxOrderIndex = Math.max(...songTypes.map((t) => t.order_index), 0);
        
        const { error } = await supabase
          .from('song_types')
          .insert([
            {
              name: validatedData.name,
              slug: validatedData.slug,
              description: validatedData.description || null,
              order_index: maxOrderIndex + 1,
              tenant_id: tenantId,
            },
          ]);

        if (error) {
          if (error.code === '23505') {
            toast.error('Já existe um tipo com esse identificador');
            return;
          }
          throw error;
        }
        toast.success('Tipo de música criado com sucesso!');
      }

      closeDialog();
      fetchSongTypes();
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        toast.error('Erro ao salvar tipo de música');
      }
    } finally {
      setSaving(false);
    }
  };

  const openDeleteDialog = (type: SongType) => {
    setTypeToDelete(type);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!typeToDelete) return;

    try {
      const { error } = await supabase
        .from('song_types')
        .delete()
        .eq('id', typeToDelete.id);

      if (error) {
        if (error.code === '23503') {
          toast.error('Este tipo está sendo usado em eventos e não pode ser removido');
        } else {
          throw error;
        }
        return;
      }

      toast.success('Tipo de música removido com sucesso!');
      setDeleteDialogOpen(false);
      setTypeToDelete(null);
      fetchSongTypes();
    } catch (error) {
      console.error('Error deleting song type:', error);
      toast.error('Erro ao remover tipo de música');
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData((prev) => ({
      ...prev,
      name,
      // Auto-generate slug only when creating new type
      slug: editingType ? prev.slug : generateSlug(name),
    }));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || savingOrder) return;

    const oldIndex = songTypes.findIndex((type) => type.id === active.id);
    const newIndex = songTypes.findIndex((type) => type.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previousOrder = songTypes;
    const reorderedTypes = arrayMove(songTypes, oldIndex, newIndex);
    setSongTypes(reorderedTypes);
    setSavingOrder(true);

    try {
      const updates = reorderedTypes.map((type, index) =>
        supabase.from('song_types').update({ order_index: index }).eq('id', type.id)
      );
      const results = await Promise.all(updates);
      const firstError = results.find((result) => result.error)?.error;

      if (firstError) throw firstError;
      toast.success('Ordem dos tipos atualizada');
    } catch (error) {
      console.error('Error reordering song types:', error);
      setSongTypes(previousOrder);
      toast.error('Erro ao reordenar tipos de música');
    } finally {
      setSavingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(buildPath('/songs'))}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Gerenciar Tipos de Música</h1>
            <p className="text-sm text-muted-foreground">
              Tipos globais reutilizáveis em todos os eventos
            </p>
          </div>
          <Button
            onClick={openCreateDialog}
            className="gradient-primary shadow-glow"
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Tipo
          </Button>
        </div>
      </header>

      <main className="container mx-auto p-4">
        <div className="space-y-3">
          {songTypes.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <GripVertical className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">Nenhum tipo de música cadastrado</h3>
              <p className="mb-4 text-sm text-muted-foreground">
                Crie tipos de música para organizar melhor seus eventos litúrgicos
              </p>
              <Button onClick={openCreateDialog} className="gradient-primary shadow-glow">
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeiro Tipo
              </Button>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card px-3 py-2 text-xs text-muted-foreground">
                <span>Arraste os itens para reordenar os tipos do repertório.</span>
                {savingOrder && (
                  <span className="inline-flex items-center gap-2 font-medium text-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Salvando ordem...
                  </span>
                )}
              </div>

              <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext
                  items={songTypes.map((type) => type.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {songTypes.map((type, index) => (
                    <SortableSongTypeItem
                      key={type.id}
                      type={type}
                      index={index}
                      disabled={savingOrder}
                      onEdit={openEditDialog}
                      onDelete={openDeleteDialog}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </>
          )}
        </div>
      </main>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingType ? 'Editar Tipo de Música' : 'Novo Tipo de Música'}
            </DialogTitle>
            <DialogDescription>
              {editingType
                ? 'Atualize as informações do tipo de música.'
                : 'Crie um novo tipo de música para organizar seus eventos.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                placeholder="Ex: Entrada"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                disabled={saving}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Identificador *</Label>
              <Input
                id="slug"
                placeholder="Ex: canto_entrada"
                value={formData.slug}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, slug: e.target.value }))
                }
                disabled={saving}
                className={errors.slug ? 'border-destructive' : ''}
              />
              <p className="text-xs text-muted-foreground">
                Usado internamente. Use letras minúsculas, números e underscore.
              </p>
              {errors.slug && (
                <p className="text-sm text-destructive">{errors.slug}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                placeholder="Breve descrição sobre este tipo de música..."
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                disabled={saving}
                rows={3}
                className={errors.description ? 'border-destructive' : ''}
              />
              {errors.description && (
                <p className="text-sm text-destructive">{errors.description}</p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeDialog}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="gradient-primary shadow-glow"
              >
                {saving ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                    Salvando...
                  </div>
                ) : editingType ? (
                  'Salvar Alterações'
                ) : (
                  'Criar Tipo'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover tipo de música?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover o tipo "{typeToDelete?.name}"?
              {'\n\n'}
              Se este tipo estiver sendo usado em algum evento, a remoção não será
              permitida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminSongTypes;


