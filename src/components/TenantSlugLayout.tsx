import { useEffect } from 'react';
import { Outlet, useParams } from 'react-router-dom';
import { useTenant } from '@/contexts/TenantContext';

export function TenantSlugLayout() {
  const { tenantSlug } = useParams();
  const { tenantSlug: currentSlug, switchTenant, userTenants, availableTenants } = useTenant();

  useEffect(() => {
    if (!tenantSlug) return;
    if (tenantSlug !== currentSlug) {
      switchTenant(tenantSlug);
    }
  }, [tenantSlug, currentSlug, switchTenant, userTenants.length, availableTenants.length]);

  return <Outlet />;
}
