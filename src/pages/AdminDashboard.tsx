import { useNavigate } from 'react-router-dom';
import { Users, UserCheck, Music, Calendar, Shield, Database, Upload, ArrowLeft, Settings } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useTenant } from '@/contexts/TenantContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface AdminCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  badge?: number;
  variant?: 'default' | 'super';
}

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSuperAdmin } = useSuperAdmin();
  const { isAdmin } = useIsAdmin();
  const { tenant, tenantId } = useTenant();

  // Count pending approvals
  const { data: pendingCount } = useQuery({
    queryKey: ['pending-approvals-count', tenantId],
    queryFn: async () => {
      if (!tenantId) return 0;
      const { count, error } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('approval_status', 'pending');
      if (error) return 0;
      return count || 0;
    },
    enabled: !!tenantId && (isAdmin || isSuperAdmin),
  });

  const prefix = '';

  const adminCards: AdminCard[] = [
    {
      title: 'Usuários',
      description: 'Gerenciar usuários do coral',
      icon: <Users className="h-6 w-6" />,
      path: `${prefix}/choir-members`,
    },
    {
      title: 'Aprovações Pendentes',
      description: 'Aprovar ou rejeitar cadastros',
      icon: <UserCheck className="h-6 w-6" />,
      path: `${prefix}/choir-members`,
      badge: pendingCount || undefined,
    },
    {
      title: 'Tipos de Música',
      description: 'Gerenciar categorias litúrgicas',
      icon: <Music className="h-6 w-6" />,
      path: `${prefix}/songs/admin/types`,
    },
    {
      title: 'Ensaios',
      description: 'Gerenciar ensaios do coral',
      icon: <Calendar className="h-6 w-6" />,
      path: `${prefix}/rehearsals`,
    },
  ];

  const superAdminCards: AdminCard[] = [
    {
      title: 'Gerenciar Tenants',
      description: 'Administrar coros e comunidades',
      icon: <Shield className="h-6 w-6" />,
      path: '/admin/tenants',
      variant: 'super',
    },
    {
      title: 'Backup',
      description: 'Exportar dados do sistema',
      icon: <Database className="h-6 w-6" />,
      path: '/admin/backup',
      variant: 'super',
    },
    {
      title: 'Restaurar',
      description: 'Importar dados de backup',
      icon: <Upload className="h-6 w-6" />,
      path: '/admin/restore',
      variant: 'super',
    },
  ];

  if (!isAdmin && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/50">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border/50">
        <Button variant="ghost" size="icon" onClick={() => navigate(prefix || '/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Painel Admin</h1>
        </div>
        {tenant && (
          <Badge variant="secondary" className="ml-auto text-xs">
            {tenant.name}
          </Badge>
        )}
      </div>

      <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto">
        {/* Admin Cards */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Administração do Coral
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {adminCards.map((card) => (
              <Card
                key={card.title}
                className="p-4 cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all group relative"
                onClick={() => navigate(card.path)}
              >
                <div className="flex flex-col gap-2">
                  <div className="text-primary group-hover:scale-110 transition-transform">
                    {card.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{card.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{card.description}</p>
                  </div>
                </div>
                {card.badge !== undefined && card.badge > 0 && (
                  <Badge className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5">
                    {card.badge}
                  </Badge>
                )}
              </Card>
            ))}
          </div>
        </div>

        {/* Super Admin Cards */}
        {isSuperAdmin && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Super Administração
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {superAdminCards.map((card) => (
                <Card
                  key={card.title}
                  className="p-4 cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all group border-primary/10 bg-primary/5"
                  onClick={() => navigate(card.path)}
                >
                  <div className="flex flex-col gap-2">
                    <div className="text-primary group-hover:scale-110 transition-transform">
                      {card.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{card.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{card.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
