import { useAuth } from '@/hooks/useAuth';
import { LoadingFallback } from '@/components/LoadingFallback';
import { lazy, Suspense } from 'react';

const Auth = lazy(() => import('@/pages/Auth'));
const TenantSelection = lazy(() => import('@/pages/TenantSelection'));

export const AuthOrTenantSelection = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingFallback />;
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      {user ? <TenantSelection /> : <Auth />}
    </Suspense>
  );
};
