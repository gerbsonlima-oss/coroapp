import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/hooks/useAuth';
import { useTenantPath } from '@/contexts/TenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, ArrowRight, LogOut, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingFallback } from '@/components/LoadingFallback';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';

interface UserTenant {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
}

const TenantSelection = () => {
  const { switchTenant, loading: tenantLoading } = useTenant();
  const { user, signOut, loading: authLoading } = useAuth();
  const { buildAuthPath } = useTenantPath();
  const [userTenants, setUserTenants] = useState<UserTenant[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    const fetchUserTenants = async () => {
      if (!user) {
        setLoadingTenants(false);
        return;
      }

      try {
        // Check if user is super_admin (tenant_id = null)
        const { data: superAdminRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .is('tenant_id', null)
          .eq('role', 'super_admin')
          .maybeSingle();

        if (superAdminRole) {
          setIsSuperAdmin(true);
          // Super admin can see all tenants
          const { data: allTenants } = await supabase
            .from('tenants')
            .select('id, slug, name, logo_url')
            .order('name');
          
          setUserTenants(allTenants || []);
        } else {
          // Regular user - fetch only their tenants via user_roles
          const { data: userRoles } = await supabase
            .from('user_roles')
            .select(`
              tenant_id,
              tenants:tenant_id (
                id,
                slug,
                name,
                logo_url
              )
            `)
            .eq('user_id', user.id)
            .not('tenant_id', 'is', null);

          if (userRoles) {
            const tenants = userRoles
              .map((role: any) => role.tenants)
              .filter((t: any): t is UserTenant => t !== null);
            
            // Remove duplicates by id
            const uniqueTenants = tenants.reduce((acc: UserTenant[], curr: UserTenant) => {
              if (!acc.find(t => t.id === curr.id)) {
                acc.push(curr);
              }
              return acc;
            }, []);
            
            setUserTenants(uniqueTenants);
          }
        }
      } catch (error) {
        console.error('Error fetching user tenants:', error);
      } finally {
        setLoadingTenants(false);
      }
    };

    fetchUserTenants();
  }, [user]);

  if (authLoading || tenantLoading || loadingTenants) {
    return <LoadingFallback />;
  }

  if (!user) {
    return <Navigate to={buildAuthPath()} replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#1a2642] to-[#0f1e3a] flex flex-col items-center justify-center p-6">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-primary rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-72 h-72 bg-primary/50 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 w-full max-w-2xl space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-3xl md:text-5xl font-light tracking-wider text-white">
            Bem-vindo ao <span className="font-semibold text-primary">CantoSacro</span>
          </h1>
          <p className="text-muted-foreground tracking-widest uppercase text-xs font-medium">
            Harmonia e organização para o seu ministério de música
          </p>
          <div className="h-px w-16 mx-auto bg-primary/30 mt-4" />
          
          {user && (
            <p className="text-white/80 text-sm mt-4">
              Olá, <span className="font-medium">{user.email}</span>
              {isSuperAdmin && <span className="ml-2 text-primary text-xs">(Super Admin)</span>}
            </p>
          )}
          
          <p className="text-white/60 text-sm mt-2">
            Selecione uma organização para continuar
          </p>
        </div>

        {userTenants.length === 0 ? (
          <Alert className="bg-white/5 border-white/10">
            <AlertCircle className="h-5 w-5 text-primary" />
            <AlertDescription className="text-white/80">
              Você ainda não tem acesso a nenhuma organização. 
              Entre em contato com um administrador para ser adicionado a um ministério.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {userTenants.map((tenant) => (
              <Card 
                key={tenant.id}
                className="group cursor-pointer bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/50 transition-all duration-300 backdrop-blur-sm overflow-hidden"
                onClick={() => switchTenant(tenant.slug)}
              >
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden border border-white/10">
                    {tenant.logo_url || (['quixada', 'coroquixada'].includes(tenant.slug)) ? (
                      <img
                        src={tenant.logo_url || "/liturgia-plus-logo.png"}
                        alt={tenant.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Building2 className="h-8 w-8 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg text-white group-hover:text-primary transition-colors leading-tight">
                      {tenant.name}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate italic">
                      {tenant.slug}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="text-center space-y-4">
          <Button
            variant="ghost"
            onClick={signOut}
            className="text-white/60 hover:text-white hover:bg-white/10"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sair da conta
          </Button>
          <p className="text-xs text-muted-foreground/60">
            Repertório Litúrgico Digital
          </p>
        </div>
      </div>
    </div>
  );
};

export default TenantSelection;
