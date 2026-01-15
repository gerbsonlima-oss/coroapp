import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: ReactNode;
  skipApprovalCheck?: boolean;
}

export const ProtectedRoute = ({ children, skipApprovalCheck = false }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

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
        return null;
      }
      return data;
    },
    enabled: !!user?.id && !skipApprovalCheck && !hasAdminRole,
    staleTime: 30000,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    // Skip approval check if user is admin/super_admin
    if (hasAdminRole) return;
    
    if (!skipApprovalCheck && !profileLoading && profile) {
      if (profile.approval_status === 'pending' || profile.approval_status === 'rejected') {
        navigate('/pending-approval');
      }
    }
  }, [profile, profileLoading, navigate, skipApprovalCheck, hasAdminRole]);

  if (loading || (!skipApprovalCheck && roleLoading) || (!skipApprovalCheck && !hasAdminRole && profileLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // If user is admin/super_admin, skip approval check
  if (hasAdminRole) {
    return <>{children}</>;
  }

  // If approval check is needed and user is not approved, don't render children
  if (!skipApprovalCheck && profile && profile.approval_status !== 'approved') {
    return null;
  }

  return <>{children}</>;
};
