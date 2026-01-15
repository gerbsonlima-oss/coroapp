import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { z } from 'zod';
import { InstallPWAButton } from '@/components/InstallPWAButton';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, MessageCircle } from 'lucide-react';
import liturgiaLogo from '@/assets/liturgia-plus-logo.png';

const authSchema = z.object({
  email: z.string().email('Email inválido').max(255, 'Email muito longo'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(100, 'Senha muito longa'),
  fullName: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100, 'Nome muito longo').optional(),
  naipe: z.string().optional(),
  birthDate: z.string().optional(),
  parish: z.string().max(100, 'Paróquia muito longa').optional(),
  phone: z.string().max(20, 'WhatsApp muito longo').optional(),
});

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [naipe, setNaipe] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [parish, setParish] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { signUp, signIn, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  // Redireciona se o usuário já estiver autenticado
  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const data = isSignUp 
        ? { email, password, fullName, naipe, birthDate, parish, phone } 
        : { email, password };
      authSchema.parse(data);

      if (isSignUp) {
        await signUp({ email, password, fullName, naipe, birthDate, parish, phone });
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

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
    } catch (error: any) {
      setErrors({ general: error.message || 'Erro ao fazer login com Google' });
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md p-6 md:p-8 shadow-card bg-card border-border">
        <div className="mb-6 text-center">
          <div className="mb-4 inline-flex">
            <img 
              src={liturgiaLogo} 
              alt="Liturgia+" 
              className="w-24 h-24 md:w-32 md:h-32 object-contain"
            />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Liturgia+</h1>
          <p className="mt-2 text-sm md:text-base text-muted-foreground">
            {isSignUp ? 'Crie sua conta' : 'Entre na sua conta'}
          </p>
          
          {/* Botão de instalação PWA */}
          <div className="mt-4">
            <InstallPWAButton 
              variant="outline" 
              size="lg"
              className="w-full text-base"
              showText={true}
            />
          </div>
        </div>

        {/* Google OAuth Button */}
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={handleGoogleLogin}
          className="w-full h-12 text-base mb-4 flex items-center justify-center gap-3"
          disabled={loading || googleLoading}
        >
          {googleLoading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
          ) : (
            <>
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continuar com Google
            </>
          )}
        </Button>

        {/* Separator */}
        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">ou</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {errors.general && (
            <Alert variant="destructive" className="py-3">
              <AlertCircle className="h-5 w-5" />
              <AlertDescription className="text-sm">
                {errors.general}
              </AlertDescription>
            </Alert>
          )}
          
          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="fullName" className="text-sm">Nome Completo</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="João Silva"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                className={`h-12 text-sm ${errors.fullName ? 'border-destructive' : ''}`}
              />
              {errors.fullName && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {errors.fullName}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="naipe" className="text-sm">Naipe</Label>
              <Select value={naipe} onValueChange={setNaipe} disabled={loading}>
                <SelectTrigger className={`h-12 text-sm ${errors.naipe ? 'border-destructive' : ''}`}>
                  <SelectValue placeholder="Selecione seu naipe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="soprano">Soprano</SelectItem>
                  <SelectItem value="contralto">Contralto</SelectItem>
                  <SelectItem value="tenor">Tenor</SelectItem>
                  <SelectItem value="baixo">Baixo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="birthDate" className="text-sm">Data de Nascimento</Label>
              <Input
                id="birthDate"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                disabled={loading}
                className={`h-12 text-sm ${errors.birthDate ? 'border-destructive' : ''}`}
              />
            </div>
          )}

          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="parish" className="text-sm">Paróquia</Label>
              <Input
                id="parish"
                type="text"
                placeholder="Nome da sua paróquia"
                value={parish}
                onChange={(e) => setParish(e.target.value)}
                disabled={loading}
                className={`h-12 text-sm ${errors.parish ? 'border-destructive' : ''}`}
              />
              {errors.parish && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {errors.parish}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-green-500" />
                WhatsApp
              </Label>
              <Input
                id="phone"
                type="tel"
                placeholder="(88) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
                className={`h-12 text-sm ${errors.phone ? 'border-destructive' : ''}`}
              />
              {errors.phone && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {errors.phone}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className={`h-12 text-sm ${errors.email ? 'border-destructive' : ''}`}
            />
            {errors.email && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {errors.email}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className={`h-12 text-sm ${errors.password ? 'border-destructive' : ''}`}
            />
            {errors.password && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {errors.password}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full gradient-primary shadow-glow text-base h-12 mt-6"
            disabled={loading}
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-background border-t-transparent" />
            ) : (
              isSignUp ? 'Criar Conta' : 'Entrar'
            )}
          </Button>
        </form>

        <div className="mt-6">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full text-base h-12"
            disabled={loading}
          >
            {isSignUp
              ? 'Já tem uma conta? Entre'
              : 'Criar uma conta'}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default Auth;
