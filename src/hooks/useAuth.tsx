import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";

function getFriendlyAuthErrorMessage(error: unknown, fallback: string): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';
  const rawMessage = message.toLowerCase();

  if (rawMessage.includes('signups not allowed for this instance')) {
    return 'Cadastro desativado neste projeto do Supabase. Ative "Enable email signups" em Authentication > Providers > Email.';
  }

  return message || fallback;
}

function getTenantSlugFromHostname(): string {
  const hostname = window.location.hostname;
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'quixada';
  }
  
  if (hostname.endsWith('.lovable.app')) {
    return 'quixada';
  }
  
  const parts = hostname.split('.');
  if (parts.length >= 3) {
    return parts[0];
  }
  
  return 'quixada';
}

interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  naipe?: string;
  birthDate?: string;
  tenantId?: string;
  tenantSlug?: string;
  phone?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (data: SignUpData) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (data: SignUpData) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error, data: authData } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: data.fullName,
            tenant_id: data.tenantId,
            tenant_slug: data.tenantSlug,
          },
        },
      });

      if (error) throw error;
      
      // Update profile with additional fields
      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            naipe: data.naipe || null,
            birth_date: data.birthDate || null,
            tenant_id: data.tenantId || null,
            phone: data.phone || null,
          })
          .eq('id', authData.user.id);
        
        if (profileError) {
          console.error('Error updating profile:', profileError);
        }
      }
      
      toast.success('Conta criada! Aguarde a aprovação do administrador.');
    } catch (error: any) {
      toast.error(getFriendlyAuthErrorMessage(error, 'Erro ao criar conta'));
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      toast.success('Login realizado com sucesso!');
    } catch (error: any) {
      toast.error(getFriendlyAuthErrorMessage(error, 'Erro ao fazer login'));
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { lovable } = await import('@/integrations/lovable/index');
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });
      if (result?.error) throw result.error;
    } catch (error: any) {
      toast.error(getFriendlyAuthErrorMessage(error, 'Erro ao fazer login com Google'));
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Logout realizado com sucesso!');
      window.location.href = '/';
    } catch (error: any) {
      toast.error(getFriendlyAuthErrorMessage(error, 'Erro ao fazer logout'));
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // Fallback para quando o AuthProvider não está presente (ex.: página /auth isolada)
    return {
      user: null,
      session: null,
      loading: false,
      signUp: async (data: SignUpData) => {
        const redirectUrl = `${window.location.origin}/`;
        
        const { error, data: authData } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            emailRedirectTo: redirectUrl,
            data: { 
              full_name: data.fullName,
              tenant_id: data.tenantId,
              tenant_slug: data.tenantSlug,
            },
          },
        });
        if (error) throw new Error(getFriendlyAuthErrorMessage(error, 'Erro ao criar conta'));
        
        if (authData.user) {
          await supabase
            .from('profiles')
            .update({
              naipe: data.naipe || null,
              birth_date: data.birthDate || null,
              tenant_id: data.tenantId || null,
              phone: data.phone || null,
            })
            .eq('id', authData.user.id);
        }
        
        toast.success('Conta criada! Aguarde a aprovação do administrador.');
      },
      signIn: async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw new Error(getFriendlyAuthErrorMessage(error, 'Erro ao fazer login'));
        toast.success('Login realizado com sucesso!');
      },
      signInWithGoogle: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw new Error(getFriendlyAuthErrorMessage(error, 'Erro ao fazer login com Google'));
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw new Error(getFriendlyAuthErrorMessage(error, 'Erro ao fazer logout'));
        toast.success('Logout realizado com sucesso!');
      },
    };
  }
  return context;
};
