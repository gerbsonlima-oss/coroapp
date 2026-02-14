import { useAuth } from '@/hooks/useAuth';
import { LoadingFallback } from '@/components/LoadingFallback';
import { lazy, Suspense } from 'react';

const Auth = lazy(() => import('@/pages/Auth'));
const Home = lazy(() => import('@/pages/Home'));

export const AuthOrTenantSelection = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingFallback />;
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      {user ? <Home /> : <Auth />}
    </Suspense>
  );
};
