import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  /** Current tenant (from URL or selection) */
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

// Routes that should NOT have tenant prefix
const PUBLIC_ROUTES = ['/auth', '/public'];

function getTenantFromPath(pathname: string): string | null {
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return null;
  }
  
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 0) {
    const potentialSlug = segments[0];
    if (/^[a-z0-9-]+$/.test(potentialSlug) && !isReservedRoute(potentialSlug)) {
      return potentialSlug;
    }
  }
  return null;
}

function isReservedRoute(segment: string): boolean {
  const reserved = [
    'events', 'songs', 'auth', 'admin', 'liturgy', 
    'rehearsals', 'public', 'audio-to-sheet'
  ];
  return reserved.includes(segment);
}

function getTenantSlugFromHostname(): string | null {
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }
  
  if (hostname.endsWith('.lovable.app')) {
    return null;
  }
  
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts[0];
  }
  
  return null;
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { saveTenantConfig, getTenantConfig } = useOfflineStorage();
  const { user } = useAuth();
  
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [userTenants, setUserTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getTenantSlug = (): string => {
    const pathTenant = getTenantFromPath(location.pathname);
    if (pathTenant) return pathTenant;
    
    const subdomainTenant = getTenantSlugFromHostname();
    if (subdomainTenant) return subdomainTenant;
    
    const storedTenant = localStorage.getItem(TENANT_STORAGE_KEY);
    if (storedTenant) return storedTenant;
    
    if (location.pathname === '/') return '';
    return 'quixada';
  };

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

  // Fetch user's tenants (from user_roles)
  useEffect(() => {
    async function fetchUserTenants() {
      if (!user) {
        setUserTenants([]);
        return;
      }

      try {
        const { data: roles, error: rolesError } = await supabase
          .from('user_roles')
          .select('tenant_id')
          .eq('user_id', user.id);

        if (rolesError) {
          console.error('Error fetching user roles:', rolesError);
          return;
        }

        const tenantIds = [...new Set(
          (roles || [])
            .map(r => r.tenant_id)
            .filter((id): id is string => id !== null)
        )];

        if (tenantIds.length === 0) {
          setUserTenants([]);
          return;
        }

        const { data: tenants, error: tenantsError } = await supabase
          .from('tenants')
          .select('id, slug, name, logo_url')
          .in('id', tenantIds)
          .order('name');

        if (!tenantsError && tenants) {
          setUserTenants(tenants);
        }
      } catch (err) {
        console.error('Error fetching user tenants:', err);
      }
    }
    fetchUserTenants();
  }, [user]);

  // Fetch current tenant from URL
  useEffect(() => {
    async function fetchTenant() {
      try {
        const slug = getTenantSlug();
        
        if (!slug && location.pathname === '/') {
          setTenant(null);
          setLoading(false);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('tenants')
          .select('id, slug, name, logo_url')
          .eq('slug', slug)
          .maybeSingle();

        if (fetchError) {
          const cachedTenant = getTenantConfig();
          if (cachedTenant) {
            setTenant(cachedTenant);
            setError(null);
          } else {
            setError('Erro ao carregar organização');
          }
          setLoading(false);
          return;
        }

        if (!data) {
          const { data: defaultData } = await supabase
            .from('tenants')
            .select('id, slug, name, logo_url')
            .eq('slug', 'quixada')
            .maybeSingle();
          
          if (defaultData) {
            setTenant(defaultData);
            saveTenantConfig(defaultData);
            localStorage.setItem(TENANT_STORAGE_KEY, defaultData.slug);
          } else {
            setError('Organização não encontrada');
          }
          setLoading(false);
          return;
        }

        setTenant(data);
        saveTenantConfig(data);
        localStorage.setItem(TENANT_STORAGE_KEY, data.slug);
        setError(null);
      } catch (err) {
        const cachedTenant = getTenantConfig();
        if (cachedTenant) {
          setTenant(cachedTenant);
          setError(null);
        } else {
          setError('Erro ao carregar organização');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchTenant();
  }, [location.pathname, saveTenantConfig, getTenantConfig]);

  const switchTenant = (slug: string) => {
    localStorage.setItem(TENANT_STORAGE_KEY, slug);
    navigate(`/${slug}`);
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

// Helper hook to build tenant-aware paths
export function useTenantPath() {
  const { tenantSlug } = useTenant();
  
  const buildPath = (path: string): string => {
    if (!tenantSlug) return path;
    if (PUBLIC_ROUTES.some(route => path.startsWith(route))) {
      return path;
    }
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `/${tenantSlug}/${cleanPath}`;
  };
  
  return { buildPath, tenantSlug };
}
