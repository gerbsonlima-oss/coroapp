import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, LogOut, RefreshCw } from 'lucide-react';
import liturgiaLogo from '@/assets/liturgia-plus-logo.png';
import { useTenantPath } from '@/contexts/TenantContext';

const PendingApproval = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();

  const { data: profile, refetch, isLoading } = useQuery({
    queryKey: ['user-approval-status', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('approval_status')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Check every 30 seconds
  });

  useEffect(() => {
    if (profile?.approval_status === 'approved') {
      navigate(buildPath('/'));
    }
  }, [profile, navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate(buildPath('/'));
  };

  const handleRefresh = () => {
    refetch();
  };

  if (profile?.approval_status === 'rejected') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#1a2642] to-[#0f1e3a] flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-destructive/20 rounded-full blur-[120px]" />
        </div>

        <Card className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-md border-white/10">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/20 flex items-center justify-center">
              <img src={liturgiaLogo} alt="CantoSacro" className="h-10 w-10 object-contain opacity-50" />
            </div>
            <CardTitle className="text-2xl text-white">Cadastro Rejeitado</CardTitle>
            <CardDescription className="text-white/60">
              Infelizmente sua solicitação de cadastro foi rejeitada.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-white/70 text-center">
              Entre em contato com o administrador do coral para mais informações.
            </p>
            <Button
              variant="outline"
              className="w-full border-white/20 text-white hover:bg-white/10"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#1a2642] to-[#0f1e3a] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <Card className="relative z-10 w-full max-w-md bg-white/5 backdrop-blur-md border-white/10">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center">
            <img src={liturgiaLogo} alt="CantoSacro" className="h-12 w-12 object-contain" />
          </div>
          <CardTitle className="text-2xl text-white flex items-center justify-center gap-2">
            <Clock className="h-6 w-6 text-primary animate-pulse" />
            Aguardando Aprovação
          </CardTitle>
          <CardDescription className="text-white/60">
            Sua solicitação de cadastro foi enviada com sucesso!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <p className="text-sm text-white/80 text-center">
              Um administrador do coral irá analisar sua solicitação em breve. 
              Você receberá acesso assim que seu cadastro for aprovado.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              className="w-full border-white/20 text-white hover:bg-white/10"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Verificar Status
            </Button>
            
            <Button
              variant="ghost"
              className="w-full text-white/60 hover:text-white hover:bg-white/5"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>

          <p className="text-xs text-white/40 text-center">
            A página atualiza automaticamente a cada 30 segundos
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;


