import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenant, useTenantPath } from '@/contexts/TenantContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ArrowLeft, Camera, Loader2, Trash2, Save, Crop, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { ImageCropper } from '@/components/ImageCropper';

interface FormData {
  name: string;
  birth_date: string;
  parish: string;
  naipe: string;
  phone: string;
  email: string;
  active: boolean;
  role: 'admin' | 'user';
}

export default function ChoirMemberForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { tenantId, tenantSlug } = useTenant();
  const { buildPath } = useTenantPath();
  const { isAdmin } = useIsAdmin();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [originalImageSrc, setOriginalImageSrc] = useState<string>('');
  const [formData, setFormData] = useState<FormData>({
    name: '',
    birth_date: '',
    parish: '',
    naipe: '',
    phone: '',
    email: '',
    active: true,
  });

  useEffect(() => {
    if (isEditing && id) {
      fetchMember();
    }
  }, [id]);

  const fetchMember = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      setFormData({
        name: data.full_name || '',
        birth_date: data.birth_date || '',
        parish: data.parish || '',
        naipe: data.naipe || '',
        phone: data.phone || '',
        email: data.email || '',
        active: data.active ?? true,
      });
      setPhotoPreview(data.photo_url);
    } catch (error: any) {
      toast.error('Erro ao carregar usuário: ' + error.message);
      navigate(buildPath('/choir-members'));
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida.');
      return;
    }

    // Create object URL for cropper
    const imageUrl = URL.createObjectURL(file);
    setOriginalImageSrc(imageUrl);
    setShowCropper(true);
    
    // Reset the input so the same file can be selected again
    e.target.value = '';
  };

  const handleCropComplete = (croppedBlob: Blob) => {
    const file = new File([croppedBlob], `cropped-${Date.now()}.webp`, { type: 'image/webp' });
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(croppedBlob));
    
    // Clean up the original image URL
    if (originalImageSrc) {
      URL.revokeObjectURL(originalImageSrc);
      setOriginalImageSrc('');
    }
  };

  const handleCropperClose = () => {
    setShowCropper(false);
    if (originalImageSrc) {
      URL.revokeObjectURL(originalImageSrc);
      setOriginalImageSrc('');
    }
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile) return photoPreview;

    const fileName = `${tenantId}/${Date.now()}.webp`;

    const { error: uploadError } = await supabase.storage
      .from('choir-member-photos')
      .upload(fileName, photoFile);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('choir-member-photos')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('O nome é obrigatório.');
      return;
    }

    if (!formData.email.trim()) {
      toast.error('O e-mail é obrigatório.');
      return;
    }

    setSaving(true);
    try {
      const photoUrl = await uploadPhoto();

      const profileData = {
        full_name: formData.name.trim(),
        birth_date: formData.birth_date || null,
        parish: formData.parish.trim() || null,
        naipe: formData.naipe || null,
        phone: formData.phone.trim() || null,
        active: formData.active,
        photo_url: photoUrl,
      };

      if (isEditing) {
        const { error } = await supabase
          .from('profiles')
          .update(profileData)
          .eq('id', id);

        if (error) throw error;
        toast.success('Usuário atualizado com sucesso!');
      } else {
        // For new members, we need an email - they need to register themselves
        toast.error('Novos usuários devem se cadastrar pelo app. Use a aba "Pendentes" para aprovar.');
        return;
      }

      navigate(buildPath('/choir-members'));
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      // We don't delete profiles, just deactivate them
      const { error } = await supabase
        .from('profiles')
        .update({ active: false, approval_status: 'rejected' })
        .eq('id', id);

      if (error) throw error;
      toast.success('Usuário desativado com sucesso!');
      navigate(buildPath('/choir-members'));
    } catch (error: any) {
      toast.error('Erro ao excluir: ' + error.message);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(buildPath('/choir-members'))}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">
              {isEditing ? 'Editar Usuário' : 'Novo Usuário'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {isEditing && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive">
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                     <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                     <AlertDialogDescription>
                       Esta ação não pode ser desfeita. O usuário será removido permanentemente.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar
            </Button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-6">
        {/* Photo */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Avatar className="h-32 w-32 border-4 border-background shadow-lg">
              <AvatarImage 
                src={photoPreview || undefined} 
                alt={formData.name}
                className="object-cover"
              />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-medium">
                {formData.name ? getInitials(formData.name) : '?'}
              </AvatarFallback>
            </Avatar>
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute bottom-0 right-0 rounded-full shadow-md"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Crop className="h-4 w-4" />
            <span>Toque para selecionar e cortar a foto</span>
          </div>
        </div>

        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Nome completo *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Digite o nome completo"
            required
          />
        </div>

        {/* Birth Date */}
        <div className="space-y-2">
          <Label htmlFor="birth_date">Data de nascimento</Label>
          <Input
            id="birth_date"
            type="date"
            value={formData.birth_date}
            onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
          />
        </div>

        {/* Naipe */}
        <div className="space-y-2">
          <Label>Naipe</Label>
          <Select value={formData.naipe} onValueChange={(value) => setFormData({ ...formData, naipe: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o naipe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="soprano">Soprano</SelectItem>
              <SelectItem value="contralto">Contralto</SelectItem>
              <SelectItem value="tenor">Tenor</SelectItem>
              <SelectItem value="baixo">Baixo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Parish */}
        <div className="space-y-2">
          <Label htmlFor="parish">Paróquia</Label>
          <Input
            id="parish"
            value={formData.parish}
            onChange={(e) => setFormData({ ...formData, parish: e.target.value })}
            placeholder="Digite a paróquia"
          />
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="(00) 00000-0000"
          />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="email@exemplo.com"
          />
        </div>

        {/* Active */}
        <div className="flex items-center justify-between p-4 bg-card rounded-lg border border-border">
          <div>
            <Label htmlFor="active" className="text-base">Status ativo</Label>
            <p className="text-sm text-muted-foreground">Usuários inativos não aparecem para seleção</p>
          </div>
          <Switch
            id="active"
            checked={formData.active}
            onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
          />
        </div>
      </form>

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

