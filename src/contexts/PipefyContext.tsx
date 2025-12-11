import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { validateToken, fetchPipes, fetchOrganizationMembers, PipefyUser, PipefyPipe, PipefyMember } from '@/lib/pipefy-api';

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
  setToken: (token: string, orgId: string) => Promise<{ success: boolean; error?: string }>;
  clearToken: () => void;
  refreshPipes: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  addHistoryRecord: (record: Omit<TransferRecord, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
}

const PipefyContext = createContext<PipefyContextType | null>(null);

const TOKEN_KEY = 'pipefy_token';
const ORG_ID_KEY = 'pipefy_org_id';
const HISTORY_KEY = 'pipefy_transfer_history';

export function PipefyProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [user, setUser] = useState<PipefyUser | null>(null);
  const [pipes, setPipes] = useState<PipefyPipe[]>([]);
  const [members, setMembers] = useState<PipefyMember[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<TransferRecord[]>([]);

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem(HISTORY_KEY);
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        setHistory(parsed.map((r: TransferRecord) => ({
          ...r,
          timestamp: new Date(r.timestamp)
        })));
      } catch {
        console.error('Error parsing history');
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    }
  }, [history]);

  // Initialize from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedOrgId = localStorage.getItem(ORG_ID_KEY);
    if (savedToken && savedOrgId) {
      validateAndSetToken(savedToken, savedOrgId);
    } else {
      setIsLoading(false);
    }
  }, []);

  const validateAndSetToken = async (newToken: string, orgId: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    
    const result = await validateToken(newToken);
    
    if (result.valid && result.user) {
      setTokenState(newToken);
      setOrganizationId(orgId);
      setUser(result.user);
      setIsConnected(true);
      localStorage.setItem(TOKEN_KEY, newToken);
      localStorage.setItem(ORG_ID_KEY, orgId);
      
      // Fetch pipes and members after successful connection
      try {
        const [pipesData, membersData] = await Promise.all([
          fetchPipes(newToken, orgId),
          fetchOrganizationMembers(newToken, orgId)
        ]);
        setPipes(pipesData);
        setMembers(membersData);
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

  const clearToken = useCallback(() => {
    setTokenState(null);
    setOrganizationId(null);
    setUser(null);
    setPipes([]);
    setMembers([]);
    setIsConnected(false);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ORG_ID_KEY);
  }, []);

  const refreshPipes = useCallback(async () => {
    if (!token || !organizationId) return;
    
    try {
      const pipesData = await fetchPipes(token, organizationId);
      setPipes(pipesData);
    } catch (error) {
      console.error('Error refreshing pipes:', error);
    }
  }, [token, organizationId]);

  const refreshMembers = useCallback(async () => {
    if (!token || !organizationId) return;
    
    try {
      const membersData = await fetchOrganizationMembers(token, organizationId);
      setMembers(membersData);
    } catch (error) {
      console.error('Error refreshing members:', error);
    }
  }, [token, organizationId]);

  const addHistoryRecord = useCallback((record: Omit<TransferRecord, 'id' | 'timestamp'>) => {
    const newRecord: TransferRecord = {
      ...record,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    
    setHistory(prev => {
      const updated = [newRecord, ...prev].slice(0, 20); // Keep last 20
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(HISTORY_KEY);
  }, []);

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
