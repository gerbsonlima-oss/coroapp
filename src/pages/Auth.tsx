import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { z } from 'zod';
import { InstallPWAButton } from '@/components/InstallPWAButton';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Mail, Lock } from 'lucide-react';

const authSchema = z.object({
  email: z.string().email('Email invÃ¡lido').max(255, 'Email muito longo'),
  password: z.string().min(6, 'Senha deve ter no mÃ­nimo 6 caracteres').max(100, 'Senha muito longa'),
});

const Auth = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();

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
      authSchema.parse({ email, password });
      await signIn(email, password);
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
            Acesso liberado apenas por administrador
          </p>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {errors.general && (
              <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  {errors.general}
                </AlertDescription>
              </Alert>
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
                placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
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
                'Entrar'
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-white/60 mt-4">
            NÃ£o tem acesso? Solicite criaÃ§Ã£o de conta a um administrador.
          </p>

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
          Liturgia+ - GestÃ£o de Coral
        </p>
      </div>
    </div>
  );
};

export default Auth;
