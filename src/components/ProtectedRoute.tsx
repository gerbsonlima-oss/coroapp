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
    enabled: !!user?.id && !skipApprovalCheck,
    staleTime: 30000,
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!skipApprovalCheck && !profileLoading && profile) {
      if (profile.approval_status === 'pending' || profile.approval_status === 'rejected') {
        navigate('/pending-approval');
      }
    }
  }, [profile, profileLoading, navigate, skipApprovalCheck]);

  if (loading || (!skipApprovalCheck && profileLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // If approval check is needed and user is not approved, don't render children
  if (!skipApprovalCheck && profile && profile.approval_status !== 'approved') {
    return null;
  }

  return <>{children}</>;
};
