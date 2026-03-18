import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { useAuth } from '@/hooks/useAuth';
import { useCopyTenantData } from '@/hooks/useCopyTenantData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Pencil, Trash2, Building2, Shield, Upload, X, Copy, Crop } from 'lucide-react';
import { ImageCropper } from '@/components/ImageCropper';

interface Tenant {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  created_at: string;
}

interface TenantFormData {
  slug: string;
  name: string;
  logo_url: string;
}

interface CopyDialogData {
  sourceTenantId: string | null;
  targetTenantId: string | null;
  dataType: 'songs' | 'events' | null;
  selectedItems: string[];
  availableItems: Array<{ id: string; name: string }>;
}

export default function AdminTenants() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: superAdminLoading } = useSuperAdmin();
  const { copyData, progress: copyProgress, reset: resetCopyProgress } = useCopyTenantData();
  
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState<TenantFormData>({
    slug: '',
    name: '',
    logo_url: '',
  });
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [originalImageSrc, setOriginalImageSrc] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copyData_state, setCopyData] = useState<CopyDialogData>({
    sourceTenantId: null,
    targetTenantId: null,
    dataType: null,
    selectedItems: [],
    availableItems: [],
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!superAdminLoading && !isSuperAdmin && user) {
      toast.error('Acesso restrito a super administradores');
      navigate('/');
    }
  }, [isSuperAdmin, superAdminLoading, user, navigate]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchTenants();
    }
  }, [isSuperAdmin]);

  async function fetchTenants() {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('name');

      if (error) throw error;
      setTenants(data || []);
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast.error('Erro ao carregar organizações');
    } finally {
      setLoading(false);
    }
  }

  function openCreateDialog() {
    setEditingTenant(null);
    setFormData({ slug: '', name: '', logo_url: '' });
    setLogoPreview(null);
    setLogoFile(null);
    setDialogOpen(true);
  }

  function openEditDialog(tenant: Tenant) {
    setEditingTenant(tenant);
    setFormData({
      slug: tenant.slug,
      name: tenant.name,
      logo_url: tenant.logo_url || '',
    });
    setLogoPreview(tenant.logo_url);
    setLogoFile(null);
    setDialogOpen(true);
  }

  function openDeleteDialog(tenant: Tenant) {
    setTenantToDelete(tenant);
    setDeleteDialogOpen(true);
  }

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2MB');
      return;
    }

    // Create object URL for cropper
    const imageUrl = URL.createObjectURL(file);
    setOriginalImageSrc(imageUrl);
    setShowCropper(true);
    
    // Reset the input so the same file can be selected again
    e.target.value = '';
  }

  function handleCropComplete(croppedBlob: Blob) {
    const file = new File([croppedBlob], `cropped-${Date.now()}.webp`, { type: 'image/webp' });
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(croppedBlob));
    setFormData({ ...formData, logo_url: '' }); // Clear URL since we have a file
    
    // Clean up the original image URL
    if (originalImageSrc) {
      URL.revokeObjectURL(originalImageSrc);
      setOriginalImageSrc('');
    }
  }

  function handleCropperClose() {
    setShowCropper(false);
    if (originalImageSrc) {
      URL.revokeObjectURL(originalImageSrc);
      setOriginalImageSrc('');
    }
  }

  async function uploadLogo(): Promise<string | null> {
    if (!logoFile) return logoPreview;

    const fileName = `${formData.slug || 'tenant'}-${Date.now()}.webp`;
    const filePath = `logos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('tenant-logos')
      .upload(filePath, logoFile, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('tenant-logos')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  function removeLogo() {
    setFormData({ ...formData, logo_url: '' });
    setLogoPreview(null);
    setLogoFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!formData.slug.trim() || !formData.name.trim()) {
      toast.error('Slug e nome são obrigatórios');
      return;
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(formData.slug)) {
      toast.error('Slug deve conter apenas letras minúsculas, números e hífens');
      return;
    }

    setSaving(true);
    setUploadingLogo(!!logoFile);

    try {
      // Upload logo if there's a new file
      const logoUrl = await uploadLogo();

      if (editingTenant) {
        const { error } = await supabase
          .from('tenants')
          .update({
            slug: formData.slug.toLowerCase().trim(),
            name: formData.name.trim(),
            logo_url: logoUrl || null,
          })
          .eq('id', editingTenant.id);

        if (error) throw error;
        toast.success('Organização atualizada com sucesso!');
      } else {
        const { error } = await supabase
          .from('tenants')
          .insert({
            slug: formData.slug.toLowerCase().trim(),
            name: formData.name.trim(),
            logo_url: logoUrl || null,
          });

        if (error) throw error;
        toast.success('Organização criada com sucesso!');
      }

      setDialogOpen(false);
      setLogoFile(null);
      fetchTenants();
    } catch (error: any) {
      console.error('Error saving tenant:', error);
      if (error.code === '23505') {
        toast.error('Já existe uma organização com este slug');
      } else {
        toast.error('Erro ao salvar organização');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!tenantToDelete) return;

    try {
      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', tenantToDelete.id);

      if (error) throw error;
      toast.success('Organização excluída com sucesso!');
      setDeleteDialogOpen(false);
      setTenantToDelete(null);
      fetchTenants();
    } catch (error) {
      console.error('Error deleting tenant:', error);
      toast.error('Erro ao excluir organização. Verifique se não há dados vinculados.');
    }
  }

  async function loadAvailableItems() {
    if (!copyData_state.sourceTenantId || !copyData_state.dataType) return;

    try {
      let items: Array<{ id: string; name: string }> = [];

      if (copyData_state.dataType === 'songs') {
        const { data } = await supabase
          .from('songs')
          .select('id, name')
          .eq('tenant_id', copyData_state.sourceTenantId)
          .order('name');
        items = data || [];
      } else if (copyData_state.dataType === 'events') {
        const { data } = await supabase
          .from('events')
          .select('id, name')
          .eq('tenant_id', copyData_state.sourceTenantId)
          .order('date');
        items = data || [];
      }

      setCopyData(prev => ({ ...prev, availableItems: items, selectedItems: [] }));
    } catch (error) {
      console.error('Erro ao carregar itens:', error);
      toast.error('Erro ao carregar itens disponíveis');
    }
  }

  async function handleCopyData() {
    if (!copyData_state.sourceTenantId || !copyData_state.targetTenantId || 
        !copyData_state.dataType || copyData_state.selectedItems.length === 0) {
      toast.error('Selecione os dados para copiar');
      return;
    }

    try {
      await copyData(
        copyData_state.sourceTenantId,
        copyData_state.targetTenantId,
        copyData_state.dataType,
        copyData_state.selectedItems
      );
      setCopyDialogOpen(false);
      resetCopyData();
    } catch (error) {
      console.error('Erro ao copiar dados:', error);
    }
  }

  function resetCopyData() {
    setCopyData({
      sourceTenantId: null,
      targetTenantId: null,
      dataType: null,
      selectedItems: [],
      availableItems: [],
    });
    resetCopyProgress();
  }

  function openCopyDialog() {
    resetCopyData();
    setCopyDialogOpen(true);
  }

  if (authLoading || superAdminLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Administração de Tenants</h1>
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              Gerencie as organizações/coros do sistema
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={openCopyDialog}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Dados
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Copiar Dados Entre Organizações</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Tenant Source */}
                  <div className="space-y-2">
                    <Label htmlFor="source-tenant">Organização Origem</Label>
                    <Select 
                      value={copyData_state.sourceTenantId || ''} 
                      onValueChange={(value) => {
                        setCopyData(prev => ({
                          ...prev,
                          sourceTenantId: value,
                          dataType: null,
                          availableItems: [],
                          selectedItems: []
                        }));
                      }}
                    >
                      <SelectTrigger id="source-tenant">
                        <SelectValue placeholder="Selecione a origem..." />
                      </SelectTrigger>
                      <SelectContent>
                        {tenants.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Data Type */}
                  <div className="space-y-2">
                    <Label htmlFor="data-type">Tipo de Dado</Label>
                    <Select 
                      value={copyData_state.dataType || ''} 
                      onValueChange={(value: any) => {
                        setCopyData(prev => ({
                          ...prev,
                          dataType: value,
                          availableItems: [],
                          selectedItems: []
                        }));
                        if (copyData_state.sourceTenantId) {
                          setTimeout(() => loadAvailableItems(), 0);
                        }
                      }}
                    >
                      <SelectTrigger id="data-type">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="songs">Músicas + Áudios</SelectItem>
                        <SelectItem value="events">Eventos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Target Tenant */}
                  <div className="space-y-2">
                    <Label htmlFor="target-tenant">Organização Destino</Label>
                    <Select 
                      value={copyData_state.targetTenantId || ''} 
                      onValueChange={(value) => {
                        setCopyData(prev => ({
                          ...prev,
                          targetTenantId: value
                        }));
                      }}
                    >
                      <SelectTrigger id="target-tenant">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {tenants.filter(t => t.id !== copyData_state.sourceTenantId).map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Items List */}
                  {copyData_state.availableItems.length > 0 && (
                    <div className="space-y-2">
                      <Label>Selecione os itens ({copyData_state.selectedItems.length}/{copyData_state.availableItems.length})</Label>
                      <ScrollArea className="h-48 border rounded-lg p-3">
                        <div className="space-y-2">
                          {copyData_state.availableItems.map(item => (
                            <div key={item.id} className="flex items-center gap-2">
                              <Checkbox
                                id={item.id}
                                checked={copyData_state.selectedItems.includes(item.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setCopyData(prev => ({
                                      ...prev,
                                      selectedItems: [...prev.selectedItems, item.id]
                                    }));
                                  } else {
                                    setCopyData(prev => ({
                                      ...prev,
                                      selectedItems: prev.selectedItems.filter(id => id !== item.id)
                                    }));
                                  }
                                }}
                              />
                              <label htmlFor={item.id} className="text-sm cursor-pointer flex-1">
                                {item.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}

                  {/* Progress Indicator */}
                  {copyProgress.status === 'loading' && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                      Copiando... {copyProgress.copied}/{copyProgress.total}
                    </div>
                  )}

                  {copyProgress.status === 'success' && (
                    <div className="text-sm text-green-600">
                      ✓ {copyProgress.copied} itens copiados com sucesso!
                    </div>
                  )}

                  {copyProgress.status === 'error' && (
                    <div className="text-sm text-red-600">
                      ✗ {copyProgress.error}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCopyDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      onClick={handleCopyData} 
                      disabled={
                        copyProgress.status === 'loading' ||
                        !copyData_state.sourceTenantId || 
                        !copyData_state.targetTenantId || 
                        !copyData_state.dataType ||
                        copyData_state.selectedItems.length === 0
                      }
                    >
                      Copiar {copyData_state.selectedItems.length} itens
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Organização
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingTenant ? 'Editar Organização' : 'Nova Organização'}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Coro Diocese Quixadá"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (subdomínio)</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    placeholder="Ex: quixada"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Será usado na URL: <code className="bg-muted px-1 rounded">/{formData.slug || 'slug'}</code>
                  </p>
                </div>
                
                {/* Logo Upload Section */}
                <div className="space-y-3">
                  <Label>Logo (moldura redonda)</Label>
                  
                  {logoPreview ? (
                    <div className="relative w-32 h-32 mx-auto">
                      <div className="w-full h-full rounded-full overflow-hidden border-4 border-primary/20 bg-muted">
                        <img
                          src={logoPreview}
                          alt="Logo preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                        onClick={removeLogo}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-32 h-32 mx-auto border-2 border-dashed border-muted-foreground/30 rounded-full flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors bg-muted/50"
                    >
                      <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                      <p className="text-xs text-muted-foreground text-center px-2">
                        Adicionar logo
                      </p>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <Crop className="h-3 w-3" />
                    <span>A imagem será recortada em círculo</span>
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoSelect}
                    className="hidden"
                    disabled={uploadingLogo || saving}
                  />
                </div>

                {/* Manual URL input as fallback */}
                <div className="space-y-2">
                  <Label htmlFor="logo_url">Ou cole a URL do logo</Label>
                  <Input
                    id="logo_url"
                    type="url"
                    value={formData.logo_url}
                    onChange={(e) => {
                      setFormData({ ...formData, logo_url: e.target.value });
                      setLogoPreview(e.target.value || null);
                    }}
                    placeholder="https://exemplo.com/logo.png"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={saving || uploadingLogo}>
                    {saving ? 'Salvando...' : editingTenant ? 'Atualizar' : 'Criar'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{tenants.length}</p>
                  <p className="text-sm text-muted-foreground">Organizações</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tenants List */}
        <div className="space-y-3">
          {tenants.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhuma organização cadastrada</p>
                <Button onClick={openCreateDialog} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Criar primeira organização
                </Button>
              </CardContent>
            </Card>
          ) : (
            tenants.map((tenant) => (
              <Card key={tenant.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden border-2 border-primary/20">
                      {tenant.logo_url ? (
                        <img
                          src={tenant.logo_url}
                          alt={tenant.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Building2 className="h-6 w-6 text-primary" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{tenant.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                          /{tenant.slug}
                        </code>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(tenant)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(tenant)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Organização</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{tenantToDelete?.name}</strong>?
              Esta ação não pode ser desfeita e todos os dados vinculados serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Cropper Modal */}
      <ImageCropper
        open={showCropper}
        onClose={handleCropperClose}
        imageSrc={originalImageSrc}
        onCropComplete={handleCropComplete}
        aspectRatio={1}
      />
    </div>
  );
}
