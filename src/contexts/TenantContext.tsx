import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
}

interface TenantContextType {
  tenant: Tenant | null;
  tenantId: string | null;
  tenantSlug: string | null;
  loading: boolean;
  error: string | null;
  availableTenants: Tenant[];
  switchTenant: (slug: string) => void;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const TENANT_STORAGE_KEY = 'selected_tenant_slug';

// Routes that should NOT have tenant prefix
const PUBLIC_ROUTES = ['/auth', '/public'];

function getTenantFromPath(pathname: string): string | null {
  // Skip public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return null;
  }
  
  // Check if first segment looks like a tenant slug
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 0) {
    const potentialSlug = segments[0];
    // Tenant slugs are lowercase alphanumeric with hyphens
    if (/^[a-z0-9-]+$/.test(potentialSlug) && !isReservedRoute(potentialSlug)) {
      return potentialSlug;
    }
  }
  return null;
}

// Reserved routes that are NOT tenant slugs
function isReservedRoute(segment: string): boolean {
  const reserved = [
    'events', 'songs', 'auth', 'admin', 'liturgy', 
    'rehearsals', 'public', 'audio-to-sheet'
  ];
  return reserved.includes(segment);
}

function getTenantSlugFromHostname(): string | null {
  const hostname = window.location.hostname;
  
  // Handle localhost development
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return null;
  }
  
  // Handle lovable.app preview URLs
  if (hostname.endsWith('.lovable.app')) {
    return null;
  }
  
  // Handle custom domains with subdomains (e.g., tenant.example.com)
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts[0];
  }
  
  return null;
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine tenant slug from various sources
  const getTenantSlug = (): string => {
    // 1. Check URL path first
    const pathTenant = getTenantFromPath(location.pathname);
    if (pathTenant) return pathTenant;
    
    // 2. Check subdomain
    const subdomainTenant = getTenantSlugFromHostname();
    if (subdomainTenant) return subdomainTenant;
    
    // 3. Check localStorage
    const storedTenant = localStorage.getItem(TENANT_STORAGE_KEY);
    if (storedTenant) return storedTenant;
    
    // 4. Default
    return 'quixada';
  };

  // Fetch available tenants for switcher
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

  useEffect(() => {
    async function fetchTenant() {
      try {
        const slug = getTenantSlug();
        
        const { data, error: fetchError } = await supabase
          .from('tenants')
          .select('id, slug, name, logo_url')
          .eq('slug', slug)
          .maybeSingle();

        if (fetchError) {
          console.error('Error fetching tenant:', fetchError);
          setError('Erro ao carregar organização');
          setLoading(false);
          return;
        }

        if (!data) {
          // Tenant not found, try default
          const { data: defaultData } = await supabase
            .from('tenants')
            .select('id, slug, name, logo_url')
            .eq('slug', 'quixada')
            .maybeSingle();
          
          if (defaultData) {
            setTenant(defaultData);
            localStorage.setItem(TENANT_STORAGE_KEY, defaultData.slug);
          } else {
            setError('Organização não encontrada');
          }
          setLoading(false);
          return;
        }

        setTenant(data);
        localStorage.setItem(TENANT_STORAGE_KEY, data.slug);
        setError(null);
      } catch (err) {
        console.error('Error in tenant fetch:', err);
        setError('Erro ao carregar organização');
      } finally {
        setLoading(false);
      }
    }

    fetchTenant();
  }, [location.pathname]);

  const switchTenant = (slug: string) => {
    localStorage.setItem(TENANT_STORAGE_KEY, slug);
    // Navigate to the new tenant's home
    navigate(`/${slug}`);
  };

  return (
    <TenantContext.Provider 
      value={{ 
        tenant, 
        tenantId: tenant?.id ?? null,
        tenantSlug: tenant?.slug ?? null,
        loading, 
        error,
        availableTenants,
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
    // Don't prefix public routes or already prefixed paths
    if (PUBLIC_ROUTES.some(route => path.startsWith(route))) {
      return path;
    }
    // Remove leading slash for concatenation
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `/${tenantSlug}/${cleanPath}`;
  };
  
  return { buildPath, tenantSlug };
}
