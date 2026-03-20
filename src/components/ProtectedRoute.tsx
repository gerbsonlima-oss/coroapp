import { ReactNode, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant, useTenantPath } from '@/contexts/TenantContext';

interface ProtectedRouteProps {
  children: ReactNode;
  skipApprovalCheck?: boolean;
}

export const ProtectedRoute = ({ children, skipApprovalCheck = false }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { buildPath, buildAuthPath } = useTenantPath();
  const { userTenants, loading: tenantLoading } = useTenant();

  // Check if user has admin or super_admin role (they don't need approval)
  const { data: hasAdminRole, isLoading: roleLoading } = useQuery({
    queryKey: ['user-admin-role', user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'super_admin']);

      if (error) {
        console.error('Error checking admin role:', error);
        return false;
      }
      return data && data.length > 0;
    },
    enabled: !!user?.id && !skipApprovalCheck,
    staleTime: 30000,
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile-approval', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('approval_status')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        throw error;
      }
      return data;
    },
    enabled: !!user?.id && !skipApprovalCheck && !hasAdminRole,
    staleTime: 30000,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate(buildAuthPath());
    }
  }, [user, loading, navigate, buildAuthPath]);

  useEffect(() => {
    // Skip approval check if user is admin/super_admin
    if (hasAdminRole) return;
    
    if (!skipApprovalCheck && !profileLoading && profile) {
      if (profile.approval_status === 'pending' || profile.approval_status === 'rejected') {
        navigate(buildPath('/pending-approval'));
      }
    }
  }, [profile, profileLoading, navigate, skipApprovalCheck, hasAdminRole, buildPath]);

  if (loading || tenantLoading || (!skipApprovalCheck && roleLoading) || (!skipApprovalCheck && !hasAdminRole && profileLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Carregando sua sessao...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={buildAuthPath()} replace />;
  }

  if (userTenants.length === 0) {
    return <Navigate to="/tenant-selection" replace />;
  }

  if (!skipApprovalCheck && !hasAdminRole && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="max-w-md rounded-xl border bg-card p-6 text-center shadow-sm">
          <h2 className="text-lg font-semibold">Nao foi possivel validar seu acesso</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Tente recarregar a pagina. Se o problema continuar, faca login novamente.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
              onClick={() => window.location.reload()}
            >
              Recarregar
            </button>
            <button
              type="button"
              className="rounded-md border px-3 py-2 text-sm hover:bg-accent"
              onClick={() => navigate(buildAuthPath())}
            >
              Ir para login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If user is admin/super_admin, skip approval check
  if (hasAdminRole) {
    return <>{children}</>;
  }

  // If approval check is needed and user is not approved, don't render children
  if (!skipApprovalCheck && profile && profile.approval_status !== 'approved') {
    return <Navigate to={buildPath('/pending-approval')} replace />;
  }

  return <>{children}</>;
};

