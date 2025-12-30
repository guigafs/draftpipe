import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // SQL para adicionar colunas nas tabelas de cache
    const migrationSQL = `
      -- Adicionar colunas na tabela pipes_cache
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pipes_cache' AND column_name = 'updated_at') THEN
          ALTER TABLE public.pipes_cache ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pipes_cache' AND column_name = 'data') THEN
          ALTER TABLE public.pipes_cache ADD COLUMN data JSONB;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pipes_cache' AND column_name = 'organization_id') THEN
          ALTER TABLE public.pipes_cache ADD COLUMN organization_id TEXT;
        END IF;
      END $$;

      -- Adicionar colunas na tabela members_cache
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members_cache' AND column_name = 'updated_at') THEN
          ALTER TABLE public.members_cache ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members_cache' AND column_name = 'data') THEN
          ALTER TABLE public.members_cache ADD COLUMN data JSONB;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'members_cache' AND column_name = 'organization_id') THEN
          ALTER TABLE public.members_cache ADD COLUMN organization_id TEXT;
        END IF;
      END $$;

      -- Criar índices únicos se não existirem
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'pipes_cache_user_org_unique') THEN
          CREATE UNIQUE INDEX pipes_cache_user_org_unique ON public.pipes_cache(user_id, organization_id);
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'members_cache_user_org_unique') THEN
          CREATE UNIQUE INDEX members_cache_user_org_unique ON public.members_cache(user_id, organization_id);
        END IF;
      EXCEPTION WHEN others THEN
        RAISE NOTICE 'Índices já existem ou erro: %', SQLERRM;
      END $$;

      -- Forçar reload do schema do PostgREST
      NOTIFY pgrst, 'reload schema';
    `;

    // Executar migração usando rpc ou query direta
    const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      // Se a função exec_sql não existir, tentar método alternativo
      console.log('Tentando método alternativo...');
      
      // Verificar estrutura atual das tabelas
      const { data: pipesColumns } = await supabase
        .from('pipes_cache')
        .select('*')
        .limit(0);
      
      const { data: membersColumns } = await supabase
        .from('members_cache')
        .select('*')
        .limit(0);

      return new Response(JSON.stringify({
        success: false,
        message: 'Função exec_sql não disponível. Execute o SQL manualmente no Supabase Dashboard.',
        sql: migrationSQL,
        hint: 'Copie o SQL acima e execute no SQL Editor do Supabase Dashboard'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Migração executada com sucesso!'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error('Erro na migração:', error);
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
