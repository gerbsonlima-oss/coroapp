import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';
import { useAuth } from '@/hooks/useAuth';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
}

interface TenantContextType {
  /** Current active tenant (first user tenant or selected) */
  tenant: Tenant | null;
  tenantId: string | null;
  tenantSlug: string | null;
  loading: boolean;
  error: string | null;
  /** All tenants available in the system */
  availableTenants: Tenant[];
  /** Tenants the current user belongs to (from user_roles) */
  userTenants: Tenant[];
  /** Tenant IDs the current user belongs to */
  userTenantIds: string[];
  /** Whether user has multiple tenants */
  isMultiTenant: boolean;
  switchTenant: (slug: string) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const TENANT_STORAGE_KEY = 'selected_tenant_slug';

export function TenantProvider({ children }: { children: ReactNode }) {
  const { saveTenantConfig, getTenantConfig } = useOfflineStorage();
  const { user } = useAuth();
  
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [userTenants, setUserTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all tenants
  useEffect(() => {
    async function fetchTenants() {
      try {
        const { data, error } = await supabase
          .from('tenants')
          .select('id, slug, name, logo_url')
          .order('name');
        
        if (!error && data) {
          setAvailableTenants(data);
        }
      } catch (err) {
        console.error('Error fetching tenants:', err);
      }
    }
    fetchTenants();
  }, []);

  // Fetch user's tenants (from user_roles) and set active tenant
  useEffect(() => {
    async function fetchUserTenants() {
      if (!user) {
        setUserTenants([]);
        setTenant(null);
        setLoading(false);
        return;
      }

      try {
        const { data: roles, error: rolesError } = await supabase
          .from('user_roles')
          .select('tenant_id')
          .eq('user_id', user.id);

        if (rolesError) {
          console.error('Error fetching user roles:', rolesError);
          setLoading(false);
          return;
        }

        const tenantIds = [...new Set(
          (roles || [])
            .map(r => r.tenant_id)
            .filter((id): id is string => id !== null)
        )];

        if (tenantIds.length === 0) {
          setUserTenants([]);
          setLoading(false);
          return;
        }

        const { data: tenants, error: tenantsError } = await supabase
          .from('tenants')
          .select('id, slug, name, logo_url')
          .in('id', tenantIds)
          .order('name');

        if (!tenantsError && tenants) {
          setUserTenants(tenants);
          
          // Only set active tenant if none is currently selected
          setTenant(prev => {
            if (prev) return prev;

            const storedSlug = localStorage.getItem(TENANT_STORAGE_KEY);
            const storedTenant =
              (storedSlug ? availableTenants.find(t => t.slug === storedSlug) : null) ||
              (storedSlug ? tenants.find(t => t.slug === storedSlug) : null);
            const activeTenant = storedTenant || tenants[0];

            if (activeTenant) {
              saveTenantConfig(activeTenant);
              localStorage.setItem(TENANT_STORAGE_KEY, activeTenant.slug);
            }
            return activeTenant || null;
          });
        }
      } catch (err) {
        console.error('Error fetching user tenants:', err);
        const cachedTenant = getTenantConfig();
        if (cachedTenant) {
          setTenant(cachedTenant);
        }
      } finally {
        setLoading(false);
      }
    }
    fetchUserTenants();
  }, [user, availableTenants]);

  const switchTenant = (slug: string) => {
    const found = userTenants.find(t => t.slug === slug) || availableTenants.find(t => t.slug === slug);
    if (found) {
      setTenant(found);
      saveTenantConfig(found);
      localStorage.setItem(TENANT_STORAGE_KEY, slug);
    }
  };

  const userTenantIds = userTenants.map(t => t.id);
  const isMultiTenant = userTenants.length > 1;

  return (
    <TenantContext.Provider 
      value={{ 
        tenant, 
        tenantId: tenant?.id ?? null,
        tenantSlug: tenant?.slug ?? null,
        loading, 
        error,
        availableTenants,
        userTenants,
        userTenantIds,
        isMultiTenant,
        switchTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
}

// Helper hook - now just returns path as-is (no tenant prefix)
export function useTenantPath() {
  const { tenantSlug } = useTenant();
  
  const buildPath = (path: string): string => {
    if (!tenantSlug) return path;
    if (!path) return `/${tenantSlug}`;
    if (path.startsWith(`/${tenantSlug}`)) return path;
    if (path.startsWith('/auth') || path.startsWith('/e/') || path.startsWith('/public') || path.startsWith('/pending-approval')) {
      return path;
    }
    if (path === '/') return `/${tenantSlug}`;
    return path.startsWith('/') ? `/${tenantSlug}${path}` : `/${tenantSlug}/${path}`;
  };
  
  return { buildPath, tenantSlug };
}
