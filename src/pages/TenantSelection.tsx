import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingFallback } from '@/components/LoadingFallback';
import coroLogo from '@/assets/coro-logo.png';

const TenantSelection = () => {
  const { availableTenants, switchTenant, loading } = useTenant();

  if (loading) {
    return <LoadingFallback />;
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
            Bem-vindo ao <span className="font-semibold text-primary">Coro App</span>
          </h1>
          <p className="text-muted-foreground tracking-widest uppercase text-xs font-medium">
            Harmonia e organização para o seu ministério de música
          </p>
          <div className="h-px w-16 mx-auto bg-primary/30 mt-4" />
          <p className="text-white/60 text-sm mt-4">
            Selecione uma organização para continuar
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableTenants.map((tenant) => (
            <Card 
              key={tenant.id}
              className="group cursor-pointer bg-white/5 border-white/10 hover:bg-white/10 hover:border-primary/50 transition-all duration-300 backdrop-blur-sm overflow-hidden"
              onClick={() => switchTenant(tenant.slug)}
            >
              <CardContent className="p-6 flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden border border-white/10">
                  {tenant.logo_url || (['quixada', 'coroquixada'].includes(tenant.slug) && coroLogo) ? (
                    <img
                      src={tenant.logo_url || coroLogo}
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

        <div className="text-center">
          <p className="text-xs text-muted-foreground/60">
            Repertório Litúrgico Digital
          </p>
        </div>
      </div>
    </div>
  );
};

export default TenantSelection;