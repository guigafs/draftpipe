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
  refreshPipes: (forceRefresh?: boolean) => Promise<void>;
  refreshMembers: (forceRefresh?: boolean) => Promise<void>;
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

  const loadPipefyConfig = async () => {
    if (!authUser?.id) return;
    
    setIsLoading(true);
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('pipefy_token, pipefy_org_id')
        .eq('id', authUser.id)
        .maybeSingle();
      
      if (error) {
        console.error('Error loading Pipefy config:', error);
        setIsLoading(false);
        return;
      }

      if (profile?.pipefy_token && profile?.pipefy_org_id) {
        await validateAndSetToken(profile.pipefy_token, profile.pipefy_org_id, false);
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error loading Pipefy config:', error);
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
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false })
        .limit(50);
      
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
    updatedAtCol: string;
    onConflict: string | null;
  };

  const cacheKeysRef = useRef<Record<string, CacheKeys | undefined>>({});

  const detectExistingColumn = useCallback(
    async (table: CacheTableName, candidates: string[]): Promise<string | null> => {
      for (const column of candidates) {
        const { error } = await supabase.from(table).select(column).limit(1);

        // If we can query it, it exists.
        if (!error) return column;

        // If the error is NOT "missing column", assume the column exists and the error is unrelated (e.g. permissions).
        if ((error as any)?.code !== 'PGRST204') return column;
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
      const updatedAtCol = (await detectExistingColumn(table, ['updated_at', 'updatedAt'])) ?? 'updated_at';
      const onConflict = orgCol ? `user_id,${orgCol}` : 'user_id';

      const keys: CacheKeys = { orgCol, dataCol, updatedAtCol, onConflict };
      cacheKeysRef.current[table] = keys;
      return keys;
    },
    [detectExistingColumn]
  );

  // Load pipes from cache or API
  const loadPipesWithCache = async (tokenValue: string, orgId: string, forceRefresh = false) => {
    if (!authUser?.id) return [];

    setPipesLoading(true);

    try {
      const keys = await getCacheKeys('pipes_cache');

      // Try to load from cache first
      if (!forceRefresh) {
        let query = supabase
          .from('pipes_cache')
          .select(`${keys.dataCol}, ${keys.updatedAtCol}`)
          .eq('user_id', authUser.id);

        if (keys.orgCol) {
          query = query.eq(keys.orgCol, orgId);
        } else {
          query = query.order(keys.updatedAtCol, { ascending: false }).limit(1);
        }

        const { data: cached, error } = await query.maybeSingle();

        if (!error && cached) {
          const updatedAtRaw = (cached as any)[keys.updatedAtCol] as string | null;
          if (updatedAtRaw) setPipesCacheUpdatedAt(new Date(updatedAtRaw));

          if (isCacheValid(updatedAtRaw ?? null)) {
            const pipesData = ((cached as any)[keys.dataCol] ?? []) as PipefyPipe[];
            setPipes(pipesData);
            setPipesLoading(false);
            return pipesData;
          }
        }
      }

      // Fetch from API
      const pipesData = await fetchPipes(tokenValue, orgId);
      setPipes(pipesData);

      // Save to cache (best-effort)
      const now = new Date();
      const payload: any = {
        user_id: authUser.id,
        [keys.dataCol]: pipesData as any,
        [keys.updatedAtCol]: now.toISOString(),
      };
      if (keys.orgCol) payload[keys.orgCol] = orgId;

      const upsertOptions = keys.onConflict ? ({ onConflict: keys.onConflict } as any) : undefined;
      let { error: upsertError } = await supabase.from('pipes_cache').upsert(payload, upsertOptions);

      // If there's no matching unique constraint for onConflict, fall back to insert.
      if (upsertError && /unique|ON CONFLICT/i.test((upsertError as any).message ?? '')) {
        ({ error: upsertError } = await supabase.from('pipes_cache').insert(payload));
      }

      if (upsertError) {
        console.error('Error caching pipes:', upsertError);
      } else {
        setPipesCacheUpdatedAt(now);
      }

      return pipesData;
    } catch (error) {
      console.error('Error loading pipes:', error);
      return [];
    } finally {
      setPipesLoading(false);
    }
  };

  // Load members from cache or API
  const loadMembersWithCache = async (tokenValue: string, orgId: string, forceRefresh = false) => {
    if (!authUser?.id) return [];

    setMembersLoading(true);

    try {
      const keys = await getCacheKeys('members_cache');

      // Try to load from cache first
      if (!forceRefresh) {
        let query = supabase
          .from('members_cache')
          .select(`${keys.dataCol}, ${keys.updatedAtCol}`)
          .eq('user_id', authUser.id);

        if (keys.orgCol) {
          query = query.eq(keys.orgCol, orgId);
        } else {
          query = query.order(keys.updatedAtCol, { ascending: false }).limit(1);
        }

        const { data: cached, error } = await query.maybeSingle();

        if (!error && cached) {
          const updatedAtRaw = (cached as any)[keys.updatedAtCol] as string | null;
          if (updatedAtRaw) setMembersCacheUpdatedAt(new Date(updatedAtRaw));

          if (isCacheValid(updatedAtRaw ?? null)) {
            const membersData = ((cached as any)[keys.dataCol] ?? []) as PipefyMember[];
            setMembers(membersData);
            setMembersLoading(false);
            return membersData;
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
        [keys.updatedAtCol]: now.toISOString(),
      };
      if (keys.orgCol) payload[keys.orgCol] = orgId;

      const upsertOptions = keys.onConflict ? ({ onConflict: keys.onConflict } as any) : undefined;
      let { error: upsertError } = await supabase.from('members_cache').upsert(payload, upsertOptions);

      // If there's no matching unique constraint for onConflict, fall back to insert.
      if (upsertError && /unique|ON CONFLICT/i.test((upsertError as any).message ?? '')) {
        ({ error: upsertError } = await supabase.from('members_cache').insert(payload));
      }

      if (upsertError) {
        console.error('Error caching members:', upsertError);
      } else {
        setMembersCacheUpdatedAt(now);
      }

      return membersData;
    } catch (error) {
      console.error('Error loading members:', error);
      return [];
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
      
      // Save to Supabase profile
      if (saveToProfile && authUser?.id) {
        const { error } = await supabase
          .from('profiles')
          .update({
            pipefy_token: newToken,
            pipefy_org_id: orgId,
          })
          .eq('id', authUser.id);
        
        if (error) {
          console.error('Error saving Pipefy config:', error);
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
    
    // Clear from Supabase profile
    if (authUser?.id) {
      await supabase
        .from('profiles')
        .update({
          pipefy_token: null,
          pipefy_org_id: null,
        })
        .eq('id', authUser.id);
    }
  }, [authUser?.id]);

  const refreshPipes = useCallback(async (forceRefresh = true) => {
    if (!token || !organizationId) return;
    await loadPipesWithCache(token, organizationId, forceRefresh);
  }, [token, organizationId, authUser?.id]);

  const refreshMembers = useCallback(async (forceRefresh = true) => {
    if (!token || !organizationId) return;
    await loadMembersWithCache(token, organizationId, forceRefresh);
  }, [token, organizationId, authUser?.id]);

  const addHistoryRecord = useCallback(async (record: Omit<TransferRecord, 'id' | 'timestamp'>) => {
    if (!authUser?.id) return;
    
    // Build cards array for JSONB column
    const cards = record.cardIds.map((cardId, index) => {
      const isSucceeded = record.succeeded.includes(cardId);
      const failedEntry = record.failed.find(f => f.cardId === cardId);
      
      return {
        id: cardId,
        title: record.cardTitles[index] || cardId,
        success: isSucceeded,
        error: failedEntry?.error || null,
      };
    });

    try {
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
      };
      
      setHistory(prev => [newRecord, ...prev].slice(0, 50));
    } catch (error) {
      console.error('Error saving history record:', error);
    }
  }, [authUser?.id]);

  const clearHistory = useCallback(async () => {
    if (!authUser?.id) return;
    
    try {
      const { error } = await supabase
        .from('transfer_history')
        .delete()
        .eq('user_id', authUser.id);

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
