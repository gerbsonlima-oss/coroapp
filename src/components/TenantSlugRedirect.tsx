import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';

const PUBLIC_PREFIXES = ['/auth', '/e/', '/public', '/pending-approval'];

export function TenantSlugRedirect() {
  const { tenantSlug } = useTenant();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const path = location.pathname;
    if (path === '/' || PUBLIC_PREFIXES.some(p => path.startsWith(p))) return;
    if (!tenantSlug) return;

    if (!path.startsWith(`/${tenantSlug}`)) {
      navigate(`/${tenantSlug}${path}${location.search}${location.hash}`, { replace: true });
    }
  }, [tenantSlug, location.pathname, location.search, location.hash, navigate]);

  return null;
}
