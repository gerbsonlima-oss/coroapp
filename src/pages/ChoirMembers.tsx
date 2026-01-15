import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, Search, Users, Music, MessageCircle, Clock, UserCheck, UserX, Check, X, Mail, Calendar, Phone, User } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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

interface ChairMember {
  id: string;
  name: string;
  birth_date: string | null;
  photo_url: string | null;
  parish: string | null;
  naipe: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
}

interface PendingProfile {
  id: string;
  email: string;
  full_name: string | null;
  naipe: string | null;
  birth_date: string | null;
  phone: string | null;
  approval_status: string;
  created_at: string | null;
  approved_at: string | null;
}

const naipeLabels: Record<string, string> = {
  soprano: 'Soprano',
  contralto: 'Contralto',
  tenor: 'Tenor',
  baixo: 'Baixo',
};

const naipeColors: Record<string, string> = {
  soprano: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  contralto: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  tenor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  baixo: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

const naipeGradients: Record<string, string> = {
  soprano: 'from-pink-500/10 to-pink-600/5',
  contralto: 'from-purple-500/10 to-purple-600/5',
  tenor: 'from-blue-500/10 to-blue-600/5',
  baixo: 'from-green-500/10 to-green-600/5',
};

export default function ChoirMembers() {
  const navigate = useNavigate();
  const { tenantId, tenantSlug, tenant } = useTenant();
  const { isAdmin } = useIsAdmin();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [members, setMembers] = useState<ChairMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterNaipe, setFilterNaipe] = useState<string>('all');
  const [selectedTab, setSelectedTab] = useState('members');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: 'approve' | 'reject';
    profile: PendingProfile | null;
  }>({ open: false, action: 'approve', profile: null });

  // Fetch pending profiles
  const { data: pendingProfiles, isLoading: loadingPending } = useQuery({
    queryKey: ['pending-approvals', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, naipe, birth_date, phone, approval_status, created_at, approved_at')
        .eq('tenant_id', tenant.id)
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as PendingProfile[];
    },
    enabled: !!tenant?.id && isAdmin,
  });

  const pendingCount = pendingProfiles?.length || 0;

  useEffect(() => {
    if (tenantId) {
      fetchMembers();
    }
  }, [tenantId]);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('choir_members')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');

      if (error) throw error;
      setMembers(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar coralistas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateApprovalMutation = useMutation({
    mutationFn: async ({ profileId, status }: { profileId: string; status: 'approved' | 'rejected' }) => {
      const updateData: any = {
        approval_status: status,
      };

      if (status === 'approved') {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = user?.id;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profileId);

      if (error) throw error;

      // If approved, create user_role entry
      if (status === 'approved' && tenant?.id) {
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', profileId)
          .eq('tenant_id', tenant.id)
          .maybeSingle();

        if (!existingRole) {
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: profileId,
              tenant_id: tenant.id,
              role: 'user',
            });

          if (roleError) {
            console.error('Error creating user role:', roleError);
          }
        }
      }
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      toast.success(status === 'approved' ? 'Usuário aprovado com sucesso!' : 'Usuário rejeitado.');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar status');
    },
  });

  const handleApproval = (profile: PendingProfile, action: 'approve' | 'reject') => {
    setConfirmDialog({ open: true, action, profile });
  };

  const confirmAction = () => {
    if (confirmDialog.profile) {
      updateApprovalMutation.mutate({
        profileId: confirmDialog.profile.id,
        status: confirmDialog.action === 'approve' ? 'approved' : 'rejected',
      });
    }
    setConfirmDialog({ open: false, action: 'approve', profile: null });
  };

  const filteredMembers = members.filter((member) => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.parish?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesNaipe = filterNaipe === 'all' || member.naipe === filterNaipe;
    return matchesSearch && matchesNaipe;
  });

  const groupedMembers = filteredMembers.reduce((acc, member) => {
    const naipe = member.naipe || 'sem_naipe';
    if (!acc[naipe]) acc[naipe] = [];
    acc[naipe].push(member);
    return acc;
  }, {} as Record<string, ChairMember[]>);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const buildPath = (path: string) => {
    return tenantSlug ? `/${tenantSlug}${path}` : path;
  };

  const formatPhoneForWhatsApp = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11 || cleaned.length === 10) {
      return `55${cleaned}`;
    }
    return cleaned;
  };

  const handleWhatsAppClick = (e: React.MouseEvent, phone: string) => {
    e.stopPropagation();
    const formattedPhone = formatPhoneForWhatsApp(phone);
    window.open(`https://wa.me/${formattedPhone}`, '_blank');
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(buildPath('/'))}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Coralistas</h1>
              <p className="text-sm text-muted-foreground">{members.length} membros</p>
            </div>
          </div>
          <Button onClick={() => navigate(buildPath('/choir-members/new'))}>
            <Plus className="h-4 w-4 mr-2" />
            Novo
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="p-4">
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="members" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Membros
            </TabsTrigger>
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pendentes
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Members Tab */}
          <TabsContent value="members" className="mt-4 space-y-4">
            {/* Filters */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou paróquia..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterNaipe} onValueChange={setFilterNaipe}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por naipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os naipes</SelectItem>
                  <SelectItem value="soprano">Soprano</SelectItem>
                  <SelectItem value="contralto">Contralto</SelectItem>
                  <SelectItem value="tenor">Tenor</SelectItem>
                  <SelectItem value="baixo">Baixo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Members Grid */}
            <div className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {searchTerm || filterNaipe !== 'all'
                      ? 'Nenhum coralista encontrado com esses filtros.'
                      : 'Nenhum coralista cadastrado ainda.'}
                  </p>
                  {!searchTerm && filterNaipe === 'all' && (
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => navigate(buildPath('/choir-members/new'))}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Cadastrar primeiro coralista
                    </Button>
                  )}
                </div>
              ) : (
                Object.entries(groupedMembers).map(([naipe, naipeMembers]) => (
                  <div key={naipe}>
                    <div className="flex items-center gap-2 mb-3">
                      <Music className="h-4 w-4 text-primary" />
                      <h2 className="font-semibold text-lg">
                        {naipe === 'sem_naipe' ? 'Sem naipe definido' : naipeLabels[naipe] || naipe}
                      </h2>
                      <Badge variant="secondary">{naipeMembers.length}</Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {naipeMembers.map((member) => (
                        <Card
                          key={member.id}
                          onClick={() => navigate(buildPath(`/choir-members/${member.id}`))}
                          className={`cursor-pointer transition-all hover:shadow-lg hover:scale-[1.02] overflow-hidden bg-gradient-to-br ${naipeGradients[member.naipe || ''] || 'from-muted/50 to-muted/30'}`}
                        >
                          <CardContent className="p-3 flex flex-col items-center text-center">
                            <Avatar className="h-20 w-20 mb-3 ring-2 ring-background shadow-md">
                              <AvatarImage 
                                src={member.photo_url || undefined} 
                                alt={member.name}
                                className="object-cover"
                              />
                              <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
                                {getInitials(member.name)}
                              </AvatarFallback>
                            </Avatar>
                            
                            <div className="space-y-1 w-full">
                              <h3 className="font-medium text-sm line-clamp-2 leading-tight">
                                {member.name}
                              </h3>
                              
                              {!member.active && (
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  Inativo
                                </Badge>
                              )}
                              
                              {member.naipe && (
                                <Badge className={`text-xs ${naipeColors[member.naipe]}`}>
                                  {naipeLabels[member.naipe]}
                                </Badge>
                              )}
                              
                              {member.phone && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="w-full mt-2 h-8 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
                                  onClick={(e) => handleWhatsAppClick(e, member.phone!)}
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                  WhatsApp
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          {/* Pending Approvals Tab */}
          <TabsContent value="pending" className="mt-4">
            {loadingPending ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : pendingProfiles && pendingProfiles.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pendingProfiles.map((profile) => (
                  <Card key={profile.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">
                              {profile.full_name || 'Sem nome'}
                            </CardTitle>
                            <CardDescription className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {profile.email}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant="secondary">Pendente</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {profile.naipe && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Music className="h-4 w-4" />
                            <span className="capitalize">{profile.naipe}</span>
                          </div>
                        )}
                        {profile.birth_date && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-4 w-4" />
                            <span>{format(new Date(profile.birth_date), 'dd/MM/yyyy')}</span>
                          </div>
                        )}
                        {profile.phone && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            <span>{profile.phone}</span>
                          </div>
                        )}
                      </div>

                      {profile.created_at && (
                        <p className="text-xs text-muted-foreground">
                          Cadastrado em {format(new Date(profile.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </p>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => handleApproval(profile, 'approve')}
                          disabled={updateApprovalMutation.isPending}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="flex-1"
                          onClick={() => handleApproval(profile, 'reject')}
                          disabled={updateApprovalMutation.isPending}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Rejeitar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma solicitação pendente</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Confirm Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === 'approve' ? 'Aprovar usuário?' : 'Rejeitar usuário?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === 'approve'
                ? `O usuário ${confirmDialog.profile?.full_name || confirmDialog.profile?.email} será aprovado e poderá acessar o sistema.`
                : `O usuário ${confirmDialog.profile?.full_name || confirmDialog.profile?.email} será rejeitado e não poderá acessar o sistema.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              className={confirmDialog.action === 'reject' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {confirmDialog.action === 'approve' ? 'Aprovar' : 'Rejeitar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
