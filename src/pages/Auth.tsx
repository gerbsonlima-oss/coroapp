import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { z } from 'zod';

import { useNavigate } from 'react-router-dom';
import { AlertCircle, MessageCircle, Mail, Lock, User, Calendar, Music, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const authSchema = z.object({
  email: z.string().email('Email inválido').max(255, 'Email muito longo'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(100, 'Senha muito longa'),
  fullName: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100, 'Nome muito longo').optional(),
  naipe: z.string().optional(),
  birthDate: z.string().optional(),
  tenantId: z.string().uuid('Selecione um coro').optional(),
  phone: z.string().max(20, 'WhatsApp muito longo').optional(),
});

// Função para aplicar máscara de telefone
const formatPhone = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) {
    return numbers;
  } else if (numbers.length <= 7) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  } else if (numbers.length <= 11) {
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  }
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

const Auth = () => {
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
  const { signUp, signIn, user } = useAuth();
  const navigate = useNavigate();

  const { data: tenants } = useQuery({
    queryKey: ['tenants-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, slug')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

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
        if (!fullName || fullName.length < 3) {
          setErrors({ fullName: 'Nome deve ter no mínimo 3 caracteres' });
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
        await signUp({ email, password, fullName, naipe, birthDate, tenantId, phone });
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/15 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/8 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-32 h-32 md:w-40 md:h-40 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 mb-4 shadow-elevated">
            <img 
              src="/liturgia-plus-logo.webp" 
              alt="CantoSacro" 
              className="w-24 h-24 md:w-32 md:h-32 object-contain"
              width={128}
              height={128}
              fetchPriority="high"
            />
          </div>
          <h1 className="text-3xl md:text-4xl font-light tracking-wide text-foreground">
            Canto<span className="font-semibold text-primary">Sacro</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground tracking-wide">
            Harmonia e organização para o seu ministério
          </p>
        </div>

        {/* Card */}
        <div className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl p-6 md:p-8 shadow-elevated">
          {/* Tab Toggle */}
          <div className="flex mb-6 bg-secondary/50 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setIsSignUp(false)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                !isSignUp 
                  ? 'bg-primary text-primary-foreground shadow-lg' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              onClick={() => setIsSignUp(true)}
              className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                isSignUp 
                  ? 'bg-primary text-primary-foreground shadow-lg' 
                  : 'text-muted-foreground hover:text-foreground'
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
                  <Label htmlFor="fullName" className="text-sm text-muted-foreground flex items-center gap-2">
                    <User className="h-3.5 w-3.5" />
                    Nome Completo *
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="João Silva"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={loading}
                    className={`h-11 bg-secondary/50 border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-primary/20 ${errors.fullName ? 'border-destructive' : ''}`}
                  />
                  {errors.fullName && (
                    <p className="text-xs text-destructive mt-1">{errors.fullName}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="naipe" className="text-sm text-muted-foreground flex items-center gap-2">
                      <Music className="h-3.5 w-3.5" />
                      Naipe
                    </Label>
                    <Select value={naipe} onValueChange={setNaipe} disabled={loading}>
                      <SelectTrigger className="h-11 bg-secondary/50 border-border/50 text-foreground focus:border-primary">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="soprano">Soprano</SelectItem>
                        <SelectItem value="contralto">Contralto</SelectItem>
                        <SelectItem value="tenor">Tenor</SelectItem>
                        <SelectItem value="baixo">Baixo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="birthDate" className="text-sm text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" />
                      Nascimento
                    </Label>
                    <Input
                      id="birthDate"
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      disabled={loading}
                      className="h-11 bg-secondary/50 border-border/50 text-foreground focus:border-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-sm text-muted-foreground flex items-center gap-2">
                    <MessageCircle className="h-3.5 w-3.5 text-success" />
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
                    className={`h-11 bg-secondary/50 border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:border-primary ${errors.phone ? 'border-destructive' : ''}`}
                  />
                  {errors.phone && (
                    <p className="text-xs text-destructive mt-1">{errors.phone}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="tenantId" className="text-sm text-muted-foreground flex items-center gap-2">
                    <Users className="h-3.5 w-3.5" />
                    Coro *
                  </Label>
                  <Select value={tenantId} onValueChange={setTenantId} disabled={loading}>
                    <SelectTrigger className={`h-11 bg-secondary/50 border-border/50 text-foreground focus:border-primary ${errors.tenantId ? 'border-destructive' : ''}`}>
                      <SelectValue placeholder="Selecione seu coro" />
                    </SelectTrigger>
                    <SelectContent>
                      {tenants?.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.tenantId && (
                    <p className="text-xs text-destructive mt-1">{errors.tenantId}</p>
                  )}
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm text-muted-foreground flex items-center gap-2">
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
                className={`h-11 bg-secondary/50 border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:border-primary ${errors.email ? 'border-destructive' : ''}`}
              />
              {errors.email && (
                <p className="text-xs text-destructive mt-1">{errors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm text-muted-foreground flex items-center gap-2">
                <Lock className="h-3.5 w-3.5" />
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className={`h-11 bg-secondary/50 border-border/50 text-foreground placeholder:text-muted-foreground/50 focus:border-primary ${errors.password ? 'border-destructive' : ''}`}
              />
              {errors.password && (
                <p className="text-xs text-destructive mt-1">{errors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full h-12 mt-4 gradient-primary shadow-glow hover:shadow-glow/50 font-medium transition-all"
              disabled={loading}
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                isSignUp ? 'Criar Conta' : 'Entrar'
              )}
            </Button>
          </form>

        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          CantoSacro - Gestão de Coral
        </p>
      </div>
    </div>
  );
};

export default Auth;
