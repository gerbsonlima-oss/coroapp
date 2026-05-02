import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { z } from 'zod';
import { InstallPWAButton } from '@/components/InstallPWAButton';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, MessageCircle, Mail, Lock, User, Calendar, Music, Users, ArrowLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenantPath } from '@/contexts/TenantContext';

const authSchema = z.object({
  email: z.string().email('Email invalido').max(255, 'Email muito longo'),
  password: z.string().min(6, 'Senha deve ter no minimo 6 caracteres').max(100, 'Senha muito longa'),
  fullName: z.string().min(3, 'Nome deve ter no minimo 3 caracteres').max(100, 'Nome muito longo').optional(),
  naipe: z.string().optional(),
  birthDate: z.string().optional(),
  tenantId: z.string().uuid('Selecione um coro').optional(),
  phone: z.string().max(20, 'WhatsApp muito longo').optional(),
});

const formatPhone = (value: string): string => {
  const numbers = value.replace(/\D/g, '');

  if (numbers.length <= 2) {
    return numbers;
  }
  if (numbers.length <= 7) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  }
  if (numbers.length <= 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  }
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

const Auth = () => {
  const { slug: routeSlug } = useParams<{ slug?: string }>();
  const isTenantScopedAuth = !!routeSlug;

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [naipe, setNaipe] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { signUp, signIn, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();

  const {
    data: contextualTenant,
    isLoading: contextualTenantLoading,
    isError: contextualTenantError,
  } = useQuery({
    queryKey: ['tenant-by-slug', routeSlug],
    queryFn: async () => {
      if (!routeSlug) return null;
      const { data, error } = await (supabase as any)
        .rpc('get_tenant_by_slug', { _slug: routeSlug })
        .maybeSingle();

      if (error) throw error;
      return data ? { id: data.id, name: data.name, slug: data.slug } : null;
    },
    enabled: isTenantScopedAuth,
  });

  const { data: tenants } = useQuery({
    queryKey: ['tenants-list'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('list_public_tenants');

      if (error) throw error;
      return ((data as any[]) || []).map((t) => ({ id: t.id, name: t.name, slug: t.slug }));
    },
    enabled: !isTenantScopedAuth,
  });

  useEffect(() => {
    if (user) {
      navigate(buildPath('/'));
    }
  }, [user, navigate, buildPath]);

  useEffect(() => {
    if (isTenantScopedAuth) {
      setIsSignUp(true);
    }
  }, [isTenantScopedAuth]);

  useEffect(() => {
    if (contextualTenant?.id) {
      setTenantId(contextualTenant.id);
    }
  }, [contextualTenant?.id]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const data = isSignUp
        ? { email, password, fullName, naipe, birthDate, tenantId, phone }
        : { email, password };

      if (isSignUp) {
        if (isTenantScopedAuth && !contextualTenant?.id) {
          setErrors({ general: 'Nao foi possivel identificar a organizacao deste link.' });
          setLoading(false);
          return;
        }

        if (!fullName || fullName.length < 3) {
          setErrors({ fullName: 'Nome deve ter no minimo 3 caracteres' });
          setLoading(false);
          return;
        }

        if (!tenantId) {
          setErrors({ tenantId: 'Selecione um coro' });
          setLoading(false);
          return;
        }
      }

      authSchema.parse(data);

      if (isSignUp) {
        await signUp({
          email,
          password,
          fullName,
          naipe,
          birthDate,
          tenantId,
          tenantSlug: contextualTenant?.slug || tenants?.find((tenant) => tenant.id === tenantId)?.slug,
          phone,
        });
      } else {
        await signIn(email, password);
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0].toString()] = err.message;
          }
        });
        setErrors(fieldErrors);
      } else {
        setErrors({ general: error.message || 'Erro ao fazer login' });
      }
    } finally {
      setLoading(false);
    }
  };

  if (isTenantScopedAuth && contextualTenantLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#1a2642] to-[#0f1e3a] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-white/80">Carregando organizacao...</p>
        </div>
      </div>
    );
  }

  if (isTenantScopedAuth && (contextualTenantError || !contextualTenant)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#1a2642] to-[#0f1e3a] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-xl font-semibold text-white">Organizacao nao encontrada</h1>
          <p className="mt-2 text-sm text-white/70">
            Este link de cadastro nao esta associado a uma organizacao valida.
          </p>
          <div className="mt-6 space-y-2">
            <Button
              type="button"
              className="w-full"
              onClick={() => navigate('/auth')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Ir para login geral
            </Button>
            <p className="text-xs text-white/50">
              Se voce recebeu este link por convite, confirme com o administrador.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#1a2642] to-[#0f1e3a] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 mb-4 shadow-xl">
            <img
              src="/liturgia-plus-logo.webp"
              alt="CantoSacro"
              className="w-24 h-24 md:w-32 md:h-32 object-contain"
              width={128}
              height={128}
              fetchPriority="high"
            />
          </div>
          <h1 className="text-3xl md:text-4xl font-light tracking-wide text-white">
            Canto<span className="font-semibold text-primary">Sacro</span>
          </h1>
          <p className="mt-2 text-sm text-white/60 tracking-wide">
            Harmonia e organizacao para o seu ministerio
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl">
          <div className="flex mb-6 bg-white/5 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setIsSignUp(false)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                !isSignUp
                  ? 'bg-primary text-white shadow-lg'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setIsSignUp(true)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                isSignUp
                  ? 'bg-primary text-white shadow-lg'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              Criar conta
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.general && (
              <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {errors.general}
                </AlertDescription>
              </Alert>
            )}

            {isSignUp && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-sm text-white/80 flex items-center gap-2">
                    <User className="h-3.5 w-3.5" />
                    Nome Completo *
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Joao Silva"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading}
                    className={`h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary focus:ring-primary/20 ${errors.fullName ? 'border-destructive' : ''}`}
                  />
                  {errors.fullName && (
                    <p className="text-xs text-destructive mt-1">{errors.fullName}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="naipe" className="text-sm text-white/80 flex items-center gap-2">
                      <Music className="h-3.5 w-3.5" />
                      Naipe
                    </Label>
                    <Select value={naipe} onValueChange={setNaipe} disabled={loading}>
                      <SelectTrigger className="h-11 bg-white/5 border-white/10 text-white focus:border-primary">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a2642] border-white/10">
                        <SelectItem value="soprano">Soprano</SelectItem>
                        <SelectItem value="contralto">Contralto</SelectItem>
                        <SelectItem value="tenor">Tenor</SelectItem>
                        <SelectItem value="baixo">Baixo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="birthDate" className="text-sm text-white/80 flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" />
                      Nascimento
                    </Label>
                    <Input
                      id="birthDate"
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      disabled={loading}
                      className="h-11 bg-white/5 border-white/10 text-white focus:border-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-sm text-white/80 flex items-center gap-2">
                    <MessageCircle className="h-3.5 w-3.5 text-green-400" />
                    WhatsApp
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(88) 99999-9999"
                    value={phone}
                    onChange={handlePhoneChange}
                    disabled={loading}
                    maxLength={15}
                    className={`h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary ${errors.phone ? 'border-destructive' : ''}`}
                  />
                  {errors.phone && (
                    <p className="text-xs text-destructive mt-1">{errors.phone}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tenantId" className="text-sm text-white/80 flex items-center gap-2">
                    <Users className="h-3.5 w-3.5" />
                    Coro *
                  </Label>
                  {isTenantScopedAuth ? (
                    <Input
                      id="tenantId"
                      value={contextualTenant?.name || ''}
                      disabled
                      className="h-11 bg-white/10 border-white/20 text-white"
                    />
                  ) : (
                    <Select value={tenantId} onValueChange={setTenantId} disabled={loading}>
                      <SelectTrigger className={`h-11 bg-white/5 border-white/10 text-white focus:border-primary ${errors.tenantId ? 'border-destructive' : ''}`}>
                        <SelectValue placeholder="Selecione seu coro" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a2642] border-white/10">
                        {tenants?.map((tenant) => (
                          <SelectItem key={tenant.id} value={tenant.id}>
                            {tenant.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {errors.tenantId && (
                    <p className="text-xs text-destructive mt-1">{errors.tenantId}</p>
                  )}
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm text-white/80 flex items-center gap-2">
                <Mail className="h-3.5 w-3.5" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className={`h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary ${errors.email ? 'border-destructive' : ''}`}
              />
              {errors.email && (
                <p className="text-xs text-destructive mt-1">{errors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm text-white/80 flex items-center gap-2">
                <Lock className="h-3.5 w-3.5" />
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className={`h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary ${errors.password ? 'border-destructive' : ''}`}
              />
              {errors.password && (
                <p className="text-xs text-destructive mt-1">{errors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full h-12 mt-4 bg-primary hover:bg-primary/90 text-white font-medium shadow-lg shadow-primary/25 transition-all"
              disabled={loading}
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                isSignUp ? 'Criar Conta' : 'Entrar'
              )}
            </Button>
          </form>

          {!isSignUp && (
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-transparent px-2 text-white/40">ou</span>
              </div>
            </div>
          )}

          {!isSignUp && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full h-12 bg-white/5 border-white/10 text-white hover:bg-white/10 hover:text-white font-medium gap-3"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                try {
                  await signInWithGoogle();
                } catch {
                  // handled in hook
                } finally {
                  setLoading(false);
                }
              }}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Entrar com Google
            </Button>
          )}

          <div className="mt-4">
            <InstallPWAButton
              variant="ghost"
              size="sm"
              className="w-full text-white/60 hover:text-white hover:bg-white/5"
              showText={true}
            />
          </div>
        </div>

        <p className="text-center text-xs text-white/40 mt-6">
          Liturgia+ - Gestao de Coral
        </p>
      </div>
    </div>
  );
};

export default Auth;
