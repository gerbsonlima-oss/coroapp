import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { z } from 'zod';
import { InstallPWAButton } from '@/components/InstallPWAButton';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, MessageCircle, Mail, Lock, User, Calendar, Music, Users } from 'lucide-react';
import liturgiaLogo from '@/assets/liturgia-plus-logo.png';
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
  // Remove tudo que não é número
  const numbers = value.replace(/\D/g, '');
  
  // Aplica a máscara
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

  // Buscar lista de tenants (coros)
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
      
      // Validação customizada para signup
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
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#1a2642] to-[#0f1e3a] flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 mb-4 shadow-xl">
            <img 
              src={liturgiaLogo} 
              alt="CantoSacro" 
              className="w-14 h-14 md:w-16 md:h-16 object-contain"
            />
          </div>
          <h1 className="text-3xl md:text-4xl font-light tracking-wide text-white">
            Canto<span className="font-semibold text-primary">Sacro</span>
          </h1>
          <p className="mt-2 text-sm text-white/60 tracking-wide">
            Harmonia e organização para o seu ministério
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl">
          {/* Tab Toggle */}
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
                    placeholder="João Silva"
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
                placeholder="••••••••"
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

          {/* PWA Install */}
          <div className="mt-4">
            <InstallPWAButton 
              variant="ghost" 
              size="sm"
              className="w-full text-white/60 hover:text-white hover:bg-white/5"
              showText={true}
            />
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-white/40 mt-6">
          Liturgia+ - Gestão de Coral
        </p>
      </div>
    </div>
  );
};

export default Auth;
