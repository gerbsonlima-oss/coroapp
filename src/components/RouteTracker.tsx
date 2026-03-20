import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';

export const RouteTracker = () => {
  const location = useLocation();
  const { tenantSlug } = useTenant();

  useEffect(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const isScopedAuth = segments.length === 2 && segments[1] === 'auth';
    const isAuthRoute = location.pathname === '/auth' || isScopedAuth;

    const normalizedPath = tenantSlug && location.pathname.startsWith(`/${tenantSlug}`)
      ? location.pathname.slice(tenantSlug.length + 1) || '/'
      : location.pathname;

    if (!isAuthRoute && normalizedPath !== '/') {
      localStorage.setItem('lastPath', location.pathname);
    }
  }, [location.pathname, tenantSlug]);

  return null;
};
