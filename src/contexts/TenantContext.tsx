import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOfflineStorage } from '@/hooks/useOfflineStorage';
import { useAuth } from '@/hooks/useAuth';
import { useLocation, useNavigate } from 'react-router-dom';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  chat_enabled: boolean;
}

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  chat_enabled?: boolean | null;
};

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

const normalizeTenants = (rows: TenantRow[] | null | undefined): Tenant[] =>
  (rows || []).map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    logo_url: t.logo_url,
    chat_enabled: Boolean(t.chat_enabled),
  }));

async function fetchTenantsWithSchemaFallback(ids?: string[]) {
  const withChatBase = supabase
    .from('tenants')
    .select('id, slug, name, logo_url, chat_enabled');

  const withChatQuery = ids && ids.length > 0 ? withChatBase.in('id', ids) : withChatBase;
  const withChat = await withChatQuery.order('name');

  if (!withChat.error) {
    return { data: normalizeTenants(withChat.data as TenantRow[]), error: null };
  }

  const fallbackBase = supabase
    .from('tenants')
    .select('id, slug, name, logo_url');

  const fallbackQuery = ids && ids.length > 0 ? fallbackBase.in('id', ids) : fallbackBase;
  const fallback = await fallbackQuery.order('name');

  if (fallback.error) {
    return { data: null as Tenant[] | null, error: fallback.error };
  }

  return { data: normalizeTenants(fallback.data as TenantRow[]), error: null };
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const { saveTenantConfig, getTenantConfig } = useOfflineStorage();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [userTenants, setUserTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all tenants
  useEffect(() => {
    async function fetchTenants() {
      try {
        const { data, error } = await fetchTenantsWithSchemaFallback();

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

        const { data: tenants, error: tenantsError } = await fetchTenantsWithSchemaFallback(tenantIds);

        if (!tenantsError && tenants) {
          setUserTenants(tenants);
          
          // Only set active tenant if none is currently selected or current is invalid
          setTenant(prev => {
            const pathnameFirstSegment = location.pathname.split('/').filter(Boolean)[0];
            const pathTenant = pathnameFirstSegment
              ? tenants.find(t => t.slug === pathnameFirstSegment)
              : null;
            if (pathTenant && (!prev || prev.id !== pathTenant.id)) {
              saveTenantConfig(pathTenant);
              localStorage.setItem(TENANT_STORAGE_KEY, pathTenant.slug);
              return pathTenant;
            }

            const currentStillValid = prev && tenants.find(t => t.id === prev.id);
            if (currentStillValid) return prev;

            const storedSlug = localStorage.getItem(TENANT_STORAGE_KEY);
            const storedTenant = storedSlug ? tenants.find(t => t.slug === storedSlug) : null;
            const activeTenant = pathTenant || storedTenant || tenants[0];
            
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
          setTenant({
            ...cachedTenant,
            chat_enabled: Boolean(cachedTenant.chat_enabled),
          });
        }
      } finally {
        setLoading(false);
      }
    }
    fetchUserTenants();
  }, [user, location.pathname]);

  const switchTenant = (slug: string) => {
    const found = userTenants.find(t => t.slug === slug) || availableTenants.find(t => t.slug === slug);
    if (found) {
      const currentPath = location.pathname || '/';
      const currentSegments = currentPath.split('/').filter(Boolean);
      const knownSlugs = new Set([
        ...userTenants.map(t => t.slug),
        ...availableTenants.map(t => t.slug),
      ]);
      const firstSegment = currentSegments[0];
      const globalSegments = new Set(['auth', 'e']);

      let nextPath = `/${slug}`;

      if (currentSegments.length === 0) {
        nextPath = `/${slug}`;
      } else if (firstSegment && knownSlugs.has(firstSegment)) {
        const rest = currentSegments.slice(1).join('/');
        nextPath = rest ? `/${slug}/${rest}` : `/${slug}`;
      } else if (firstSegment && globalSegments.has(firstSegment)) {
        nextPath = `/${slug}`;
      } else {
        nextPath = `/${slug}/${currentSegments.join('/')}`;
      }

      setTenant(found);
      saveTenantConfig(found);
      localStorage.setItem(TENANT_STORAGE_KEY, slug);
      navigate(`${nextPath}${location.search}${location.hash}`, { replace: true });
    }
  };

  const userTenantIds = userTenants.map(t => t.id);
  const isMultiTenant = userTenants.length > 1;

  useEffect(() => {
    if (!location.pathname) return;
    const firstSegment = location.pathname.split('/').filter(Boolean)[0];
    if (!firstSegment) return;

    const globalSegments = new Set(['auth', 'e']);
    const appRoots = new Set([
      'events',
      'songs',
      'admin',
      'rehearsals',
      'liturgy',
      'chat',
      'audio-to-sheet',
      'choir-members',
      'pending-approval',
      'public',
    ]);

    if (globalSegments.has(firstSegment) || appRoots.has(firstSegment)) return;

    const fromUserTenants = userTenants.find(t => t.slug === firstSegment);
    const fromAvailable = availableTenants.find(t => t.slug === firstSegment);
    const fromPath = fromUserTenants || fromAvailable;

    if (!fromPath) return;
    if (tenant?.id === fromPath.id) return;

    setTenant(fromPath);
    saveTenantConfig(fromPath);
    localStorage.setItem(TENANT_STORAGE_KEY, fromPath.slug);
  }, [location.pathname, userTenants, availableTenants, tenant?.id, saveTenantConfig]);

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
  const { tenantSlug, userTenants, availableTenants } = useTenant();
  const location = useLocation();
  const currentPathFirstSegment = location.pathname.split('/').filter(Boolean)[0];
  const appRoots = new Set([
    'events',
    'songs',
    'admin',
    'rehearsals',
    'liturgy',
    'chat',
    'audio-to-sheet',
    'choir-members',
    'pending-approval',
    'public',
    'tenant-selection',
  ]);
  const globalPrefixes = new Set(['auth', 'e', 'tenant-selection']);
  const currentPathSlug =
    currentPathFirstSegment &&
    !globalPrefixes.has(currentPathFirstSegment) &&
    !appRoots.has(currentPathFirstSegment)
      ? currentPathFirstSegment
      : '';
  const activeSlug =
    currentPathSlug ||
    tenantSlug ||
    localStorage.getItem(TENANT_STORAGE_KEY) ||
    '';

  const buildAuthPath = (): string => {
    if (!activeSlug) return '/auth';
    return `/${activeSlug}/auth`;
  };
  
  const buildPath = (path: string): string => {
    if (!path) return path;
    if (/^https?:\/\//i.test(path)) return path;

    const normalized = path.startsWith('/') ? path : `/${path}`;
    const firstSegment = normalized.split('/').filter(Boolean)[0];

    if (firstSegment && globalPrefixes.has(firstSegment)) {
      return normalized;
    }

    const knownSlugs = new Set([
      ...userTenants.map(t => t.slug),
      ...availableTenants.map(t => t.slug),
    ]);
    const segments = normalized.split('/').filter(Boolean);
    const secondSegment = segments[1];
    const looksLikeSlugPrefixed =
      !!firstSegment &&
      !globalPrefixes.has(firstSegment) &&
      !appRoots.has(firstSegment) &&
      (segments.length === 1 || (secondSegment ? appRoots.has(secondSegment) : false));

    if (firstSegment && knownSlugs.has(firstSegment)) {
      return normalized;
    }
    if (looksLikeSlugPrefixed) {
      return normalized;
    }

    if (!activeSlug) return normalized;

    if (normalized === '/') return `/${activeSlug}`;
    if (normalized === `/${activeSlug}` || normalized.startsWith(`/${activeSlug}/`)) {
      return normalized;
    }

    return `/${activeSlug}${normalized}`;
  };
  
  return { buildPath, buildAuthPath, tenantSlug };
}
