import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useSuperAdmin() {
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkSuperAdmin() {
      if (!user) {
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      try {
        // Use RPC or raw query since 'super_admin' might not be in TypeScript enum
        const { data, error } = await supabase
          .rpc('is_super_admin', { _user_id: user.id });

        if (error) {
          console.error('Error checking super admin:', error);
          setIsSuperAdmin(false);
        } else {
          setIsSuperAdmin(!!data);
        }
      } catch (err) {
        console.error('Error in super admin check:', err);
        setIsSuperAdmin(false);
      } finally {
        setLoading(false);
      }
    }

    checkSuperAdmin();
  }, [user]);

  return { isSuperAdmin, loading };
}
