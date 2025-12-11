// Pipefy GraphQL API Service

const PIPEFY_API_URL = 'https://api.pipefy.com/graphql';

export interface PipefyUser {
  id: string;
  name: string;
  email: string;
  username?: string;
}

export interface PipefyMember {
  role_name: string;
  user: PipefyUser;
}

export interface PipefyPhase {
  id: string;
  name: string;
}

export interface PipefyCard {
  id: string;
  title: string;
  current_phase: PipefyPhase;
  assignees: PipefyUser[];
  created_at?: string;
}

export interface PipefyPipe {
  id: string;
  name: string;
}

export interface PipefyOrganization {
  id: string;
  name: string;
  pipes?: PipefyPipe[];
  members?: PipefyMember[];
}

export interface ApiError {
  message: string;
  code?: string;
}

// Rate limiting helper
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 60; // 60ms between requests (500 requests / 30 seconds)

async function rateLimitedRequest<T>(
  token: string,
  query: string,
  variables?: Record<string, unknown>,
  retries = 3
): Promise<T> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();

  try {
    const response = await fetch(PIPEFY_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 401) {
      throw new Error('Token inválido ou expirado. Verifique suas credenciais.');
    }

    if (response.status === 429) {
      if (retries > 0) {
        // Exponential backoff
        const waitTime = Math.pow(2, 4 - retries) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return rateLimitedRequest(token, query, variables, retries - 1);
      }
      throw new Error('Limite de requisições excedido. Tente novamente em alguns segundos.');
    }

    if (response.status >= 500) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return rateLimitedRequest(token, query, variables, retries - 1);
      }
      throw new Error('Erro no servidor do Pipefy. Tente novamente mais tarde.');
    }

    const data = await response.json();

    if (data.errors && data.errors.length > 0) {
      throw new Error(data.errors[0].message || 'Erro na requisição ao Pipefy');
    }

    return data.data as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Erro de conexão. Verifique sua internet.');
  }
}

// Validate token by fetching user info
export async function validateToken(token: string): Promise<{ valid: boolean; user?: PipefyUser; error?: string }> {
  const query = `
    query {
      me {
        id
        name
        email
      }
    }
  `;

  try {
    const data = await rateLimitedRequest<{ me: PipefyUser }>(token, query);
    return { valid: true, user: data.me };
  } catch (error) {
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Erro ao validar token' 
    };
  }
}

// Fetch organization members
export async function fetchOrganizationMembers(
  token: string, 
  organizationId: string
): Promise<PipefyMember[]> {
  const query = `
    query($orgId: ID!) {
      organization(id: $orgId) {
        name
        members {
          role_name
          user {
            id
            name
            email
            username
          }
        }
      }
    }
  `;

  const data = await rateLimitedRequest<{ organization: PipefyOrganization }>(
    token, 
    query, 
    { orgId: organizationId }
  );
  
  return data.organization.members || [];
}

// Fetch organization pipes
export async function fetchPipes(token: string, organizationId: string): Promise<PipefyPipe[]> {
  const query = `
    query($orgId: ID!) {
      organization(id: $orgId) {
        pipes {
          id
          name
        }
      }
    }
  `;

  const data = await rateLimitedRequest<{ organization: PipefyOrganization }>(
    token, 
    query, 
    { orgId: organizationId }
  );
  
  return data.organization.pipes || [];
}

// Search cards by assignee email
export async function searchCardsByAssignee(
  token: string,
  pipeId: string,
  email: string
): Promise<PipefyCard[]> {
  const query = `
    query($pipeId: ID!, $assigneeEmail: [String]) {
      cards(pipe_id: $pipeId, search: {assignee_emails: $assigneeEmail}) {
        edges {
          node {
            id
            title
            current_phase {
              id
              name
            }
            assignees {
              id
              name
              email
            }
            created_at
          }
        }
      }
    }
  `;

  const data = await rateLimitedRequest<{ cards: { edges: { node: PipefyCard }[] } }>(
    token,
    query,
    { pipeId, assigneeEmail: [email] }
  );

  return data.cards.edges.map(edge => edge.node);
}

// Search user by email
export async function searchUserByEmail(token: string, email: string): Promise<PipefyUser | null> {
  const query = `
    query($email: String!) {
      findUsers(email: $email) {
        id
        name
        email
      }
    }
  `;

  try {
    const data = await rateLimitedRequest<{ findUsers: PipefyUser[] }>(token, query, { email });
    return data.findUsers && data.findUsers.length > 0 ? data.findUsers[0] : null;
  } catch {
    // Try alternative query
    const altQuery = `
      query {
        me {
          organizations {
            members {
              user {
                id
                name
                email
              }
            }
          }
        }
      }
    `;
    
    try {
      const altData = await rateLimitedRequest<{ 
        me: { 
          organizations: { 
            members: { user: PipefyUser }[] 
          }[] 
        } 
      }>(token, altQuery);
      
      for (const org of altData.me.organizations) {
        const member = org.members.find(m => m.user.email.toLowerCase() === email.toLowerCase());
        if (member) return member.user;
      }
      return null;
    } catch {
      return null;
    }
  }
}

// Update card assignee
export async function updateCardAssignee(
  token: string,
  cardId: string,
  newAssigneeIds: string[]
): Promise<{ success: boolean; card?: PipefyCard; error?: string }> {
  const mutation = `
    mutation($cardId: ID!, $assigneeIds: [ID]) {
      updateCard(input: {id: $cardId, assignee_ids: $assigneeIds}) {
        card {
          id
          title
          assignees {
            id
            email
            name
          }
        }
      }
    }
  `;

  try {
    const data = await rateLimitedRequest<{ updateCard: { card: PipefyCard } }>(
      token,
      mutation,
      { cardId, assigneeIds: newAssigneeIds }
    );
    return { success: true, card: data.updateCard.card };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Erro ao atualizar card' 
    };
  }
}

// Batch transfer cards
export async function transferCards(
  token: string,
  cardIds: string[],
  newAssigneeId: string,
  onProgress?: (completed: number, total: number, cardId: string, success: boolean, error?: string) => void
): Promise<{ succeeded: string[]; failed: { cardId: string; error: string }[] }> {
  const results = {
    succeeded: [] as string[],
    failed: [] as { cardId: string; error: string }[],
  };

  for (let i = 0; i < cardIds.length; i++) {
    const cardId = cardIds[i];
    const result = await updateCardAssignee(token, cardId, [newAssigneeId]);
    
    if (result.success) {
      results.succeeded.push(cardId);
      onProgress?.(i + 1, cardIds.length, cardId, true);
    } else {
      results.failed.push({ cardId, error: result.error || 'Erro desconhecido' });
      onProgress?.(i + 1, cardIds.length, cardId, false, result.error);
    }
    
    // Small delay between operations to respect rate limits
    if (i < cardIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}
