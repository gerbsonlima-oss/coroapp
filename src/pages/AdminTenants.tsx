import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { useAuth } from '@/hooks/useAuth';
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
import { toast } from 'sonner';
import { ArrowLeft, Plus, Pencil, Trash2, Building2, Shield, Upload, X } from 'lucide-react';

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

export default function AdminTenants() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { isSuperAdmin, loading: superAdminLoading } = useSuperAdmin();
  
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setDialogOpen(true);
  }

  function openDeleteDialog(tenant: Tenant) {
    setTenantToDelete(tenant);
    setDeleteDialogOpen(true);
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
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

    setUploadingLogo(true);

    try {
      const fileName = `${formData.slug || 'tenant'}-${Date.now()}.${file.name.split('.').pop()}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('tenant-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('tenant-logos')
        .getPublicUrl(filePath);

      setFormData({ ...formData, logo_url: data.publicUrl });
      setLogoPreview(data.publicUrl);
      toast.success('Logo enviado com sucesso!');
    } catch (error: any) {
      console.error('Error uploading logo:', error);
      toast.error('Erro ao enviar logo: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setUploadingLogo(false);
    }
  }

  function removeLogo() {
    setFormData({ ...formData, logo_url: '' });
    setLogoPreview(null);
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

    try {
      if (editingTenant) {
        const { error } = await supabase
          .from('tenants')
          .update({
            slug: formData.slug.toLowerCase().trim(),
            name: formData.name.trim(),
            logo_url: formData.logo_url.trim() || null,
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
            logo_url: formData.logo_url.trim() || null,
          });

        if (error) throw error;
        toast.success('Organização criada com sucesso!');
      }

      setDialogOpen(false);
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
                <div className="space-y-2">
                  <Label>Logo (usado na splash screen)</Label>
                  
                  {logoPreview ? (
                    <div className="relative w-32 h-32 mx-auto">
                      <img
                        src={logoPreview}
                        alt="Logo preview"
                        className="w-full h-full object-contain rounded-lg border bg-muted"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute -top-2 -right-2 h-6 w-6"
                        onClick={removeLogo}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    >
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Clique para enviar logo
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        PNG, JPG até 2MB
                      </p>
                    </div>
                  )}
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    disabled={uploadingLogo}
                  />
                  
                  {uploadingLogo && (
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                      Enviando...
                    </div>
                  )}
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
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                      {tenant.logo_url ? (
                        <img
                          src={tenant.logo_url}
                          alt={tenant.name}
                          className="h-full w-full object-contain"
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
    </div>
  );
}
