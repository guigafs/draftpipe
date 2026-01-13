import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { validateToken, fetchPipes, fetchOrganizationMembers, PipefyUser, PipefyPipe, PipefyMember } from '@/lib/pipefy-api';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface TransferRecord {
  id: string;
  timestamp: Date;
  fromEmail: string;
  toEmail: string;
  cardIds: string[];
  cardTitles: string[];
  succeeded: string[];
  failed: { cardId: string; error: string }[];
  pipeName: string;
  pipeId: string;
  performedByEmail: string;
}

interface RefreshResult {
  ok: boolean;
  cacheSaved: boolean;
  cacheError?: string;
}

interface PipefyContextType {
  token: string | null;
  user: PipefyUser | null;
  pipes: PipefyPipe[];
  members: PipefyMember[];
  organizationId: string | null;
  isConnected: boolean;
  isLoading: boolean;
  history: TransferRecord[];
  historyLoading: boolean;
  pipesLoading: boolean;
  membersLoading: boolean;
  pipesCacheUpdatedAt: Date | null;
  membersCacheUpdatedAt: Date | null;
  setToken: (token: string, orgId: string) => Promise<{ success: boolean; error?: string }>;
  clearToken: () => Promise<void>;
  refreshPipes: (forceRefresh?: boolean) => Promise<RefreshResult>;
  refreshMembers: (forceRefresh?: boolean) => Promise<RefreshResult>;
  addHistoryRecord: (record: Omit<TransferRecord, 'id' | 'timestamp'>) => Promise<void>;
  clearHistory: () => Promise<void>;
}

const PipefyContext = createContext<PipefyContextType | null>(null);

// Cache expiration time: 1 hour
const CACHE_TTL_MS = 60 * 60 * 1000;

export function PipefyProvider({ children }: { children: React.ReactNode }) {
  const { user: authUser, isAuthenticated } = useAuth();
  
  const [token, setTokenState] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [user, setUser] = useState<PipefyUser | null>(null);
  const [pipes, setPipes] = useState<PipefyPipe[]>([]);
  const [members, setMembers] = useState<PipefyMember[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<TransferRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pipesLoading, setPipesLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [pipesCacheUpdatedAt, setPipesCacheUpdatedAt] = useState<Date | null>(null);
  const [membersCacheUpdatedAt, setMembersCacheUpdatedAt] = useState<Date | null>(null);

  // Load Pipefy config and history from Supabase when authenticated
  useEffect(() => {
    if (isAuthenticated && authUser?.id) {
      loadPipefyConfig();
      loadHistory();
    } else {
      // Reset state when logged out
      setTokenState(null);
      setOrganizationId(null);
      setUser(null);
      setPipes([]);
      setMembers([]);
      setIsConnected(false);
      setHistory([]);
      setIsLoading(false);
    }
  }, [isAuthenticated, authUser?.id]);

  // Carrega configuração global do Pipefy a partir da tabela pipefy_settings
  const loadPipefyConfig = async () => {
    if (!authUser?.id) return;
    
    setIsLoading(true);
    try {
      const { data: settings, error } = await supabase
        .from('pipefy_settings')
        .select('pipefy_token, pipefy_org_id')
        .eq('id', 1)
        .maybeSingle();
      
      if (error) {
        console.error('Error loading Pipefy config:', error);
        setIsLoading(false);
        setIsConnected(false);
        return;
      }

      if (settings?.pipefy_token && settings?.pipefy_org_id) {
        await validateAndSetToken(settings.pipefy_token, settings.pipefy_org_id, false);
      } else {
        setIsConnected(false);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error loading Pipefy config:', error);
      setIsConnected(false);
      setIsLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!authUser?.id) return;
    
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('transfer_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) {
        console.error('Error loading history:', error);
        return;
      }

      if (data) {
        const records: TransferRecord[] = data.map((row: any) => ({
          id: row.id,
          timestamp: new Date(row.created_at),
          fromEmail: row.from_user_email,
          toEmail: row.to_user_email,
          cardIds: row.cards?.map((c: any) => c.id) || [],
          cardTitles: row.cards?.map((c: any) => c.title) || [],
          succeeded: row.cards?.filter((c: any) => c.success).map((c: any) => c.id) || [],
          failed: row.cards?.filter((c: any) => !c.success).map((c: any) => ({
            cardId: c.id,
            error: c.error || 'Unknown error'
          })) || [],
          pipeName: row.pipe_name,
          pipeId: row.pipe_id,
          performedByEmail: row.performed_by_email || '',
        }));
        setHistory(records);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Check if cache is valid (not expired)
  const isCacheValid = (updatedAt: string | null): boolean => {
    if (!updatedAt) return false;
    const cacheTime = new Date(updatedAt).getTime();
    return Date.now() - cacheTime < CACHE_TTL_MS;
  };

  type CacheTableName = 'pipes_cache' | 'members_cache';

  type CacheKeys = {
    orgCol: string | null;
    dataCol: string;
    updatedAtCol: string | null; // null if no timestamp column exists
    onConflict: string | null;
  };

  const cacheKeysRef = useRef<Record<string, CacheKeys | undefined>>({});

  const detectExistingColumn = useCallback(
    async (table: CacheTableName, candidates: string[]): Promise<string | null> => {
      for (const column of candidates) {
        const { error } = await supabase.from(table).select(column).limit(1);

        // If we can query it, it exists.
        if (!error) return column;

        const errCode = (error as any)?.code;
        const errMsg = ((error as any)?.message || '').toLowerCase();

        // Column does not exist if:
        // - PGRST204: Could not find ... column ... in schema cache
        // - 42703: undefined_column (Postgres error)
        // - message contains "does not exist" or "could not find"
        const isMissingColumn =
          errCode === 'PGRST204' ||
          errCode === '42703' ||
          errMsg.includes('does not exist') ||
          errMsg.includes('could not find');

        if (isMissingColumn) {
          // Column truly missing, try next candidate
          continue;
        }

        // For other errors (like RLS permission), assume column exists
        return column;
      }
      return null;
    },
    []
  );

  const getCacheKeys = useCallback(
    async (table: CacheTableName): Promise<CacheKeys> => {
      const existing = cacheKeysRef.current[table];
      if (existing) return existing;

      const orgCol = await detectExistingColumn(table, ['organization_id', 'pipefy_org_id', 'org_id']);
      const dataCol = (await detectExistingColumn(table, ['data'])) ?? 'data';
      // Try multiple timestamp column names; null if none exist
      const updatedAtCol = await detectExistingColumn(table, ['updated_at', 'updatedAt', 'created_at', 'createdAt']);
      const onConflict = orgCol ? `user_id,${orgCol}` : 'user_id';

      const keys: CacheKeys = { orgCol, dataCol, updatedAtCol, onConflict };
      cacheKeysRef.current[table] = keys;
      
      // Diagnostic log (temporary)
      console.info(`[Cache] ${table} keys detected:`, { orgCol, dataCol, updatedAtCol, onConflict });
      
      return keys;
    },
    [detectExistingColumn]
  );

  // Load pipes from cache or API
  const loadPipesWithCache = async (
    tokenValue: string,
    orgId: string,
    forceRefresh = false
  ): Promise<{ data: PipefyPipe[]; cacheSaved: boolean; cacheError?: string }> => {
    if (!authUser?.id) return { data: [], cacheSaved: false, cacheError: 'Usuário não autenticado' };

    setPipesLoading(true);

    try {
      const keys = await getCacheKeys('pipes_cache');

      // Try to load from cache first
      if (!forceRefresh) {
        // Build select columns dynamically
        const selectCols = keys.updatedAtCol 
          ? `${keys.dataCol}, ${keys.updatedAtCol}` 
          : keys.dataCol;
        
        let query = supabase
          .from('pipes_cache')
          .select(selectCols)
          .eq('user_id', authUser.id);

        if (keys.orgCol) {
          query = query.eq(keys.orgCol, orgId);
        } else if (keys.updatedAtCol) {
          query = query.order(keys.updatedAtCol, { ascending: false }).limit(1);
        } else {
          query = query.limit(1);
        }

        const { data: cached, error } = await query.maybeSingle();

        if (!error && cached) {
          const updatedAtRaw = keys.updatedAtCol 
            ? (cached as any)[keys.updatedAtCol] as string | null 
            : null;
          if (updatedAtRaw) setPipesCacheUpdatedAt(new Date(updatedAtRaw));

          // If no timestamp column, treat cache as expired (always fetch fresh)
          const cacheValid = keys.updatedAtCol ? isCacheValid(updatedAtRaw) : false;
          
          const cachedData = (cached as any)[keys.dataCol] as PipefyPipe[] | undefined;
          console.log('[Cache] Dados carregados do pipes_cache:', {
            pipesCount: cachedData?.length || 0,
            totalPhases: cachedData?.reduce((acc, p) => acc + (p.phases?.length || 0), 0) || 0,
            updatedAt: updatedAtRaw,
            cacheValid: cacheValid,
            primeiroPipe: cachedData?.[0] ? {
              id: cachedData[0].id,
              name: cachedData[0].name,
              phasesCount: cachedData[0].phases?.length || 0
            } : null
          });
          
          if (cacheValid) {
            const pipesData = ((cached as any)[keys.dataCol] ?? []) as PipefyPipe[];
            setPipes(pipesData);
            setPipesLoading(false);
            return { data: pipesData, cacheSaved: true };
          }
        }
      }

      // Fetch from API
      const pipesData = await fetchPipes(tokenValue, orgId);
      setPipes(pipesData);

      // Log dos dados da API
      console.log('[Cache] Dados da API Pipefy:', {
        pipesCount: pipesData.length,
        totalPhases: pipesData.reduce((acc, p) => acc + (p.phases?.length || 0), 0),
        primeiroPipe: pipesData[0] ? {
          id: pipesData[0].id,
          name: pipesData[0].name,
          phasesCount: pipesData[0].phases?.length || 0,
          phases: pipesData[0].phases?.map(p => p.name)
        } : null
      });

      // Save to cache (best-effort)
      const now = new Date();
      const payload: any = {
        user_id: authUser.id,
        [keys.dataCol]: pipesData as any,
      };
      // Only include timestamp if column exists
      if (keys.updatedAtCol) {
        payload[keys.updatedAtCol] = now.toISOString();
      }
      if (keys.orgCol) payload[keys.orgCol] = orgId;

      // Log do payload antes de salvar
      console.log('[Cache] Payload para salvar no pipes_cache:', {
        userId: authUser.id,
        orgId,
        pipesCount: pipesData.length,
        hasPhases: pipesData.some(p => (p.phases?.length || 0) > 0),
        keys,
        payloadSizeKB: Math.round(JSON.stringify(payload).length / 1024)
      });

      const upsertOptions = keys.onConflict ? ({ onConflict: keys.onConflict } as any) : undefined;
      console.log('[Cache] Opções upsert:', upsertOptions);

      let { error: upsertError, data: upsertData } = await supabase
        .from('pipes_cache')
        .upsert(payload, upsertOptions)
        .select();

      // Log do resultado do upsert
      console.log('[Cache] Resultado do upsert pipes_cache:', {
        success: !upsertError,
        error: upsertError,
        dataReturned: !!upsertData,
        rowsAffected: upsertData?.length || 0
      });

      // If there's no matching unique constraint for onConflict, fall back to insert.
      if (upsertError && /unique|ON CONFLICT/i.test((upsertError as any).message ?? '')) {
        console.log('[Cache] Tentando insert como fallback...');
        const insertResult = await supabase.from('pipes_cache').insert(payload).select();
        upsertError = insertResult.error;
        console.log('[Cache] Resultado do insert fallback:', {
          success: !insertResult.error,
          error: insertResult.error
        });
      }

      if (upsertError) {
        console.error('Error caching pipes:', upsertError);
        const errMsg = (upsertError as any)?.message || 'Erro desconhecido';
        return { data: pipesData, cacheSaved: false, cacheError: errMsg };
      }

      setPipesCacheUpdatedAt(now);
      return { data: pipesData, cacheSaved: true };
    } catch (error) {
      console.error('Error loading pipes:', error);
      return { data: [], cacheSaved: false, cacheError: String(error) };
    } finally {
      setPipesLoading(false);
    }
  };

  // Load members from cache or API
  const loadMembersWithCache = async (
    tokenValue: string,
    orgId: string,
    forceRefresh = false
  ): Promise<{ data: PipefyMember[]; cacheSaved: boolean; cacheError?: string }> => {
    if (!authUser?.id) return { data: [], cacheSaved: false, cacheError: 'Usuário não autenticado' };

    setMembersLoading(true);

    try {
      const keys = await getCacheKeys('members_cache');

      // Try to load from cache first
      if (!forceRefresh) {
        // Build select columns dynamically
        const selectCols = keys.updatedAtCol 
          ? `${keys.dataCol}, ${keys.updatedAtCol}` 
          : keys.dataCol;
        
        let query = supabase
          .from('members_cache')
          .select(selectCols)
          .eq('user_id', authUser.id);

        if (keys.orgCol) {
          query = query.eq(keys.orgCol, orgId);
        } else if (keys.updatedAtCol) {
          query = query.order(keys.updatedAtCol, { ascending: false }).limit(1);
        } else {
          query = query.limit(1);
        }

        const { data: cached, error } = await query.maybeSingle();

        if (!error && cached) {
          const updatedAtRaw = keys.updatedAtCol 
            ? (cached as any)[keys.updatedAtCol] as string | null 
            : null;
          if (updatedAtRaw) setMembersCacheUpdatedAt(new Date(updatedAtRaw));

          // If no timestamp column, treat cache as expired (always fetch fresh)
          const cacheValid = keys.updatedAtCol ? isCacheValid(updatedAtRaw) : false;
          
          if (cacheValid) {
            const membersData = ((cached as any)[keys.dataCol] ?? []) as PipefyMember[];
            setMembers(membersData);
            setMembersLoading(false);
            return { data: membersData, cacheSaved: true };
          }
        }
      }

      // Fetch from API
      const membersData = await fetchOrganizationMembers(tokenValue, orgId);
      setMembers(membersData);

      // Save to cache (best-effort)
      const now = new Date();
      const payload: any = {
        user_id: authUser.id,
        [keys.dataCol]: membersData as any,
      };
      // Only include timestamp if column exists
      if (keys.updatedAtCol) {
        payload[keys.updatedAtCol] = now.toISOString();
      }
      if (keys.orgCol) payload[keys.orgCol] = orgId;

      const upsertOptions = keys.onConflict ? ({ onConflict: keys.onConflict } as any) : undefined;
      let { error: upsertError } = await supabase.from('members_cache').upsert(payload, upsertOptions);

      // If there's no matching unique constraint for onConflict, fall back to insert.
      if (upsertError && /unique|ON CONFLICT/i.test((upsertError as any).message ?? '')) {
        ({ error: upsertError } = await supabase.from('members_cache').insert(payload));
      }

      if (upsertError) {
        console.error('Error caching members:', upsertError);
        const errMsg = (upsertError as any)?.message || 'Erro desconhecido';
        return { data: membersData, cacheSaved: false, cacheError: errMsg };
      }

      setMembersCacheUpdatedAt(now);
      return { data: membersData, cacheSaved: true };
    } catch (error) {
      console.error('Error loading members:', error);
      return { data: [], cacheSaved: false, cacheError: String(error) };
    } finally {
      setMembersLoading(false);
    }
  };

  const validateAndSetToken = async (
    newToken: string, 
    orgId: string,
    saveToProfile: boolean = true
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    const result = await validateToken(newToken);
    
    if (result.valid && result.user) {
      setTokenState(newToken);
      setOrganizationId(orgId);
      setUser(result.user);
      setIsConnected(true);
      
      // Save to pipefy_settings (global config)
      if (saveToProfile) {
        const { error } = await supabase
          .from('pipefy_settings')
          .upsert({
            id: 1,
            pipefy_token: newToken,
            pipefy_org_id: orgId,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'id' });
        
        if (error) {
          console.error('Error saving Pipefy config:', error);
          setIsLoading(false);
          return { success: false, error: 'Falha ao salvar configuração no banco. Verifique suas permissões.' };
        }
      }
      
      // Fetch pipes and members with cache
      try {
        await Promise.all([
          loadPipesWithCache(newToken, orgId),
          loadMembersWithCache(newToken, orgId)
        ]);
      } catch (error) {
        console.error('Error fetching organization data:', error);
      }
      
      setIsLoading(false);
      return { success: true };
    } else {
      setIsLoading(false);
      return { success: false, error: result.error };
    }
  };

  const clearToken = useCallback(async () => {
    setTokenState(null);
    setOrganizationId(null);
    setUser(null);
    setPipes([]);
    setMembers([]);
    setIsConnected(false);
    
    // Clear from pipefy_settings (global config)
    await supabase
      .from('pipefy_settings')
      .update({
        pipefy_token: null,
        pipefy_org_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
  }, [authUser?.id]);

  const refreshPipes = useCallback(async (forceRefresh = true): Promise<RefreshResult> => {
    if (!token || !organizationId) return { ok: false, cacheSaved: false, cacheError: 'Não conectado ao Pipefy' };
    const result = await loadPipesWithCache(token, organizationId, forceRefresh);
    return { ok: result.data.length > 0 || result.cacheSaved, cacheSaved: result.cacheSaved, cacheError: result.cacheError };
  }, [token, organizationId, authUser?.id]);

  const refreshMembers = useCallback(async (forceRefresh = true): Promise<RefreshResult> => {
    if (!token || !organizationId) return { ok: false, cacheSaved: false, cacheError: 'Não conectado ao Pipefy' };
    const result = await loadMembersWithCache(token, organizationId, forceRefresh);
    return { ok: result.data.length > 0 || result.cacheSaved, cacheSaved: result.cacheSaved, cacheError: result.cacheError };
  }, [token, organizationId, authUser?.id]);

  const addHistoryRecord = useCallback(async (record: Omit<TransferRecord, 'id' | 'timestamp'>) => {
    if (!authUser?.id) return;
    
    // CRITICAL: Normalize all IDs to strings for consistent comparison
    const succeededIds = record.succeeded.map(id => String(id));
    const failedCards = record.failed.map(f => ({
      ...f,
      cardId: String(f.cardId)
    }));
    
    // Build cards array for JSONB column
    const cards = record.cardIds.map((cardId, index) => {
      const cardIdStr = String(cardId);
      const isSucceeded = succeededIds.includes(cardIdStr);
      const failedEntry = failedCards.find(f => f.cardId === cardIdStr);
      
      return {
        id: cardIdStr,
        title: record.cardTitles[index] || cardIdStr,
        success: isSucceeded,
        error: failedEntry?.error || null,
      };
    });

    try {
      const performedByEmail = authUser.email || record.fromEmail;
      
      const { data, error } = await supabase
        .from('transfer_history')
        .insert({
          user_id: authUser.id,
          from_user_email: record.fromEmail,
          to_user_email: record.toEmail,
          pipe_id: record.pipeId,
          pipe_name: record.pipeName,
          cards: cards,
          succeeded_count: record.succeeded.length,
          failed_count: record.failed.length,
          performed_by_email: performedByEmail,
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving history record:', error);
        return;
      }

      // Add to local state
      const newRecord: TransferRecord = {
        ...record,
        id: data.id,
        timestamp: new Date(data.created_at),
        performedByEmail: performedByEmail,
      };
      
      setHistory(prev => [newRecord, ...prev].slice(0, 50));
    } catch (error) {
      console.error('Error saving history record:', error);
    }
  }, [authUser?.id]);

  const clearHistory = useCallback(async () => {
    if (!authUser?.id) return;
    
    try {
      // RLS policy ensures only admins can delete
      const { error } = await supabase
        .from('transfer_history')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

      if (error) {
        console.error('Error clearing history:', error);
        return;
      }

      setHistory([]);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  }, [authUser?.id]);

  return (
    <PipefyContext.Provider
      value={{
        token,
        user,
        pipes,
        members,
        organizationId,
        isConnected,
        isLoading,
        history,
        historyLoading,
        pipesLoading,
        membersLoading,
        pipesCacheUpdatedAt,
        membersCacheUpdatedAt,
        setToken: validateAndSetToken,
        clearToken,
        refreshPipes,
        refreshMembers,
        addHistoryRecord,
        clearHistory,
      }}
    >
      {children}
    </PipefyContext.Provider>
  );
}

export function usePipefy() {
  const context = useContext(PipefyContext);
  if (!context) {
    throw new Error('usePipefy must be used within a PipefyProvider');
  }
  return context;
}
