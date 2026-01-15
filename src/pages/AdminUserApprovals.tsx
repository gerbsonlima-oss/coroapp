import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, X, Clock, User, Mail, Church, Music, Calendar, Phone, ArrowLeft, UserCheck, UserX } from 'lucide-react';
import { Link } from 'react-router-dom';
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

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  naipe: string | null;
  birth_date: string | null;
  parish: string | null;
  phone: string | null;
  approval_status: string;
  created_at: string | null;
  approved_at: string | null;
}

const AdminUserApprovals = () => {
  const { tenant } = useTenant();
  const { isAdmin } = useIsAdmin();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState('pending');
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: 'approve' | 'reject';
    profile: Profile | null;
  }>({ open: false, action: 'approve', profile: null });

  const { data: profiles, isLoading } = useQuery({
    queryKey: ['user-approvals', tenant?.id, selectedTab],
    queryFn: async () => {
      if (!tenant?.id) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, naipe, birth_date, parish, phone, approval_status, created_at, approved_at')
        .eq('tenant_id', tenant.id)
        .eq('approval_status', selectedTab)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Profile[];
    },
    enabled: !!tenant?.id && isAdmin,
  });

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
        // Check if role already exists
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
      queryClient.invalidateQueries({ queryKey: ['user-approvals'] });
      toast.success(status === 'approved' ? 'Usuário aprovado com sucesso!' : 'Usuário rejeitado.');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar status');
    },
  });

  const handleApproval = (profile: Profile, action: 'approve' | 'reject') => {
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

  const pendingCount = profiles?.filter(p => p.approval_status === 'pending').length || 0;

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Você não tem permissão para acessar esta página.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Aprovação de Usuários</h1>
          <p className="text-muted-foreground">Gerencie solicitações de cadastro</p>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Pendentes
            {selectedTab !== 'pending' && pendingCount > 0 && (
              <Badge variant="destructive" className="ml-1">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Aprovados
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex items-center gap-2">
            <UserX className="h-4 w-4" />
            Rejeitados
          </TabsTrigger>
        </TabsList>

        <TabsContent value={selectedTab} className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : profiles && profiles.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {profiles.map((profile) => (
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
                      <Badge
                        variant={
                          profile.approval_status === 'approved'
                            ? 'default'
                            : profile.approval_status === 'rejected'
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {profile.approval_status === 'approved'
                          ? 'Aprovado'
                          : profile.approval_status === 'rejected'
                          ? 'Rejeitado'
                          : 'Pendente'}
                      </Badge>
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
                      {profile.parish && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Church className="h-4 w-4" />
                          <span className="truncate">{profile.parish}</span>
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

                    {profile.approval_status === 'pending' && (
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
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  {selectedTab === 'pending' ? (
                    <>
                      <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma solicitação pendente</p>
                    </>
                  ) : selectedTab === 'approved' ? (
                    <>
                      <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum usuário aprovado</p>
                    </>
                  ) : (
                    <>
                      <UserX className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum usuário rejeitado</p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

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
};

export default AdminUserApprovals;
