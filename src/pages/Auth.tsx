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
import { AlertCircle } from 'lucide-react';
import liturgiaLogo from '@/assets/liturgia-plus-logo.png';

const authSchema = z.object({
  email: z.string().email('Email inválido').max(255, 'Email muito longo'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(100, 'Senha muito longa'),
  fullName: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100, 'Nome muito longo').optional(),
  naipe: z.string().optional(),
  birthDate: z.string().optional(),
  parish: z.string().max(100, 'Paróquia muito longa').optional(),
  phone: z.string().max(20, 'Telefone muito longo').optional(),
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
  const { signUp, signIn, user } = useAuth();
  const navigate = useNavigate();

  // Redireciona se o usuário já estiver autenticado
  useEffect(() => {
    if (user) {
      navigate('/events');
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
              <Label htmlFor="phone" className="text-sm">Telefone (WhatsApp)</Label>
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

        <div className="mt-6 space-y-3">
          {!isSignUp && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => navigate('/events')}
              className="w-full text-base h-12"
              disabled={loading}
            >
              Entrar sem conta
            </Button>
          )}
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