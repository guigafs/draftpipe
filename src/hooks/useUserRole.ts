import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const ADMIN_EMAIL = 'guilherme@apollos.com.br';

export function useUserRole() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkRole() {
      if (!user) {
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }

      // Verificar pelo email do admin
      if (user.email === ADMIN_EMAIL) {
        setIsAdmin(true);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (error) {
          console.error('Erro ao verificar role:', error);
          setIsAdmin(false);
        } else {
          setIsAdmin(!!data);
        }
      } catch (err) {
        console.error('Erro ao verificar role:', err);
        setIsAdmin(false);
      }

      setIsLoading(false);
    }

    checkRole();
  }, [user]);

  return { isAdmin, isLoading };
}
