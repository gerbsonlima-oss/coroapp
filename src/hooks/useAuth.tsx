import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from "sonner";

interface SignUpData {
  email: string;
  password: string;
  fullName: string;
  naipe?: string;
  birthDate?: string;
  parish?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (data: SignUpData) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
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
            parish: data.parish || null,
          })
          .eq('id', authData.user.id);
        
        if (profileError) {
          console.error('Error updating profile:', profileError);
        }
      }
      
      toast.success('Conta criada com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar conta');
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
      toast.error(error.message || 'Erro ao fazer login');
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast.success('Logout realizado com sucesso!');
      window.location.href = '/auth';
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer logout');
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
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
            data: { full_name: data.fullName },
          },
        });
        if (error) throw error;
        
        if (authData.user) {
          await supabase
            .from('profiles')
            .update({
              naipe: data.naipe || null,
              birth_date: data.birthDate || null,
              parish: data.parish || null,
            })
            .eq('id', authData.user.id);
        }
        
        toast.success('Conta criada com sucesso!');
      },
      signIn: async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success('Login realizado com sucesso!');
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        toast.success('Logout realizado com sucesso!');
      },
    };
  }
  return context;
};