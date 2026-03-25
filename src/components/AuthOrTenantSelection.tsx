import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/contexts/TenantContext';
import { LoadingFallback } from '@/components/LoadingFallback';
import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router-dom';

const Auth = lazy(() => import('@/pages/Auth'));
const TenantSelection = lazy(() => import('@/pages/TenantSelection'));

export const AuthOrTenantSelection = () => {
  const { user, loading } = useAuth();
  const { userTenants, loading: tenantLoading } = useTenant();

  if (loading || tenantLoading) {
    return <LoadingFallback />;
  }

  if (user && userTenants.length === 1) {
    return <Navigate to={`/${userTenants[0].slug}`} replace />;
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      {user ? <TenantSelection /> : <Auth />}
    </Suspense>
  );
};
