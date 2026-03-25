import { useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useTenant, useTenantPath } from '@/contexts/TenantContext';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, ArrowRight, LogOut, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingFallback } from '@/components/LoadingFallback';
import { Alert, AlertDescription } from '@/components/ui/alert';

const TenantSelection = () => {
  const { switchTenant, userTenants, loading: tenantLoading } = useTenant();
  const { user, signOut, loading: authLoading } = useAuth();
  const { buildAuthPath } = useTenantPath();
  const didAutoSwitchRef = useRef(false);

  useEffect(() => {
    if (authLoading || tenantLoading) return;
    if (!user) return;
    if (userTenants.length !== 1) return;
    if (didAutoSwitchRef.current) return;

    didAutoSwitchRef.current = true;
    switchTenant(userTenants[0].slug);
  }, [authLoading, tenantLoading, user, userTenants, switchTenant]);

  if (authLoading || tenantLoading) {
    return <LoadingFallback />;
  }

  if (!user) {
    return <Navigate to={buildAuthPath()} replace />;
  }

  if (userTenants.length === 1) {
    return <Navigate to={`/${userTenants[0].slug}`} replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#1a2642] to-[#0f1e3a] flex flex-col items-center justify-center p-6">
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
            Harmonia e organizacao para o seu ministerio de musica
          </p>
          <div className="h-px w-16 mx-auto bg-primary/30 mt-4" />

          <p className="text-white/80 text-sm mt-4">
            Ola, <span className="font-medium">{user.email}</span>
          </p>

          <p className="text-white/60 text-sm mt-2">
            Selecione uma organizacao para continuar
          </p>
        </div>

        {userTenants.length === 0 ? (
          <Alert className="bg-white/5 border-white/10">
            <AlertCircle className="h-5 w-5 text-primary" />
            <AlertDescription className="text-white/80">
              Voce ainda nao tem acesso a nenhuma organizacao.
              Entre em contato com um administrador para ser adicionado a um ministerio.
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
                        src={tenant.logo_url || '/liturgia-plus-logo.png'}
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
            Repertorio Liturgico Digital
          </p>
        </div>
      </div>
    </div>
  );
};

export default TenantSelection;
