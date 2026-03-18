import { useAuth } from '@/hooks/useAuth';
import { LoadingFallback } from '@/components/LoadingFallback';
import { lazy, Suspense, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';

const Auth = lazy(() => import('@/pages/Auth'));
const Home = lazy(() => import('@/pages/Home'));

export const AuthOrTenantSelection = () => {
  const { user, loading } = useAuth();
  const { tenantSlug } = useTenant();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && tenantSlug) {
      navigate(`/${tenantSlug}`);
    }
  }, [user, tenantSlug, navigate]);

  if (loading) {
    return <LoadingFallback />;
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      {user ? <Home /> : <Auth />}
    </Suspense>
  );
};
