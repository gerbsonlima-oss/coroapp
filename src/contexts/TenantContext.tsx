import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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
  loading: boolean;
  error: string | null;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

function getTenantSlugFromHostname(): string {
  const hostname = window.location.hostname;
  
  // Handle localhost development - default to 'quixada'
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'quixada';
  }
  
  // Handle lovable.app preview URLs (e.g., project-name.lovable.app)
  if (hostname.endsWith('.lovable.app')) {
    // For preview, use default tenant
    return 'quixada';
  }
  
  // Handle custom domains with subdomains (e.g., tenant.example.com)
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    // First part is the subdomain/tenant slug
    return parts[0];
  }
  
  // Fallback to default tenant
  return 'quixada';
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTenant() {
      try {
        const slug = getTenantSlugFromHostname();
        
        const { data, error: fetchError } = await supabase
          .from('tenants')
          .select('id, slug, name, logo_url')
          .eq('slug', slug)
          .maybeSingle();

        if (fetchError) {
          console.error('Error fetching tenant:', fetchError);
          setError('Erro ao carregar organização');
          return;
        }

        if (!data) {
          console.warn(`Tenant not found for slug: ${slug}`);
          setError('Organização não encontrada');
          return;
        }

        setTenant(data);
        setError(null);
      } catch (err) {
        console.error('Error in tenant fetch:', err);
        setError('Erro ao carregar organização');
      } finally {
        setLoading(false);
      }
    }

    fetchTenant();
  }, []);

  return (
    <TenantContext.Provider 
      value={{ 
        tenant, 
        tenantId: tenant?.id ?? null,
        loading, 
        error 
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
